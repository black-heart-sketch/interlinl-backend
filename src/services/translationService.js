const translate = require('google-translate-api-x');
const Redis = require('ioredis');
const mongoose = require('mongoose');

let redisClient = null;
const FRONTEND_LANGUAGE_CODES = ['en', 'de', 'fr', 'it'];
const WARMUP_PREFIXES = ['partner', 'testimonial', 'program', 'event', 'research', 'institute', 'activity'];

function normalizeLanguageCode(lang) {
  if (!lang || typeof lang !== 'string') return null;
  const normalized = lang.split('-')[0].toLowerCase();
  return FRONTEND_LANGUAGE_CODES.includes(normalized) ? normalized : null;
}

const connectRedis = () => {
  return new Promise((resolve, reject) => {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000
    });

    redisClient.on('connect', () => {
      console.log(`Redis connected successfully on ${url}`);
      resolve(redisClient);
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err.message);
      reject(err);
    });
  });
};

exports.connectRedis = connectRedis;

const TRANSLATABLE_FIELDS = [
  'title', 'description', 'message', 'quote', 'text', 
  'highlights', 'objectives', 'outcomes', 'prerequisites',
  'role', 'story', 'content', 'country', 'destinationCountry', 'city', 'program',
  'location', 'extra_info', 'questionText', 'explanation', 'options'
];

async function deepTranslate(data, targetLang) {
  const normalizedTargetLang = normalizeLanguageCode(targetLang);
  if (!data || !normalizedTargetLang) return data;
  
  const stringsToTranslate = [];
  const mapList = []; 

  function traverseAndCollect(obj, parentKey = null) {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'string' && TRANSLATABLE_FIELDS.includes(parentKey)) {
          stringsToTranslate.push(item);
          mapList.push({ parent: obj, key: index });
        } else if (typeof item === 'object' && item !== null) {
          traverseAndCollect(item, parentKey);
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (TRANSLATABLE_FIELDS.includes(key) && typeof obj[key] === 'string' && obj[key].trim().length > 0) {
          stringsToTranslate.push(obj[key]);
          mapList.push({ parent: obj, key: key });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          traverseAndCollect(obj[key], key);
        }
      }
    }
  }

  const clonedData = JSON.parse(JSON.stringify(data));
  traverseAndCollect(clonedData, null);

  if (stringsToTranslate.length === 0) return clonedData;

  try {
    const results = await translate(stringsToTranslate, { to: normalizedTargetLang });
    const translatedArray = Array.isArray(results) ? results : [results];

    for (let i = 0; i < translatedArray.length; i++) {
      const { parent, key } = mapList[i];
      parent[key] = translatedArray[i].text;
    }
    
    return clonedData;
  } catch (err) {
    console.error('Translation API error:', err.message);
    return data; // Return original on failure
  }
}

exports.getCachedOrTranslated = async (reqKey, targetLang, fetchCallback) => {
  const normalizedTargetLang = normalizeLanguageCode(targetLang);
  const cacheKey = `translation:${reqKey}:${normalizedTargetLang || 'default'}`;

  // Try Redis first
  if (redisClient && redisClient.status === 'ready') {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.error('Redis GET error:', e.message);
    }
  }

  // Fetch original DB data
  const rawData = await fetchCallback();
  
  if (!normalizedTargetLang) return rawData; // If no supported lang provided, return raw

  // Translate
  const translatedData = await deepTranslate(rawData, normalizedTargetLang);

  // Save to Cache (24 hours = 86400 seconds)
  if (redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.set(cacheKey, JSON.stringify(translatedData), 'EX', 86400);
    } catch (e) {
      console.error('Redis SET error:', e.message);
    }
  }

  return translatedData;
};

// Dual-resolution model helper to prevent circular/startup import issues
function getModel(modelName) {
  try {
    return mongoose.model(modelName);
  } catch (e) {
    try {
      return require(`../models/${modelName}`);
    } catch (requireErr) {
      return null;
    }
  }
}

// Mirrors the language selected in the frontend i18n switcher.
async function getActiveLanguageCodes() {
  return FRONTEND_LANGUAGE_CODES;
}

exports.warmupCollection = async (prefix, targetLang = null) => {
  if (!WARMUP_PREFIXES.includes(prefix)) return;

  if (!targetLang) {
    const langs = await getActiveLanguageCodes();
    for (const lang of langs) {
      await exports.warmupCollection(prefix, lang).catch(err => {
        console.error(`⚠️ Error warming up prefix "${prefix}" for lang "${lang}":`, err.message);
      });
    }
    return;
  }

  switch (prefix) {
    case 'partner': {
      const Partner = getModel('Partner');
      if (!Partner) return;
      
      const allPartners = await exports.getCachedOrTranslated('partners:all', targetLang, () =>
        Partner.find().sort({ createdAt: -1 })
      );
      
      await exports.getCachedOrTranslated('partners:active', targetLang, () =>
        Partner.find({ status: 'active', publicVisible: true }).sort({ createdAt: -1 })
      );
      
      if (Array.isArray(allPartners)) {
        for (const item of allPartners) {
          await exports.getCachedOrTranslated(`partner:${item._id}`, targetLang, () =>
            Partner.findById(item._id)
          );
        }
      }
      break;
    }

    case 'testimonial': {
      const Testimonial = getModel('Testimonial');
      if (!Testimonial) return;
      
      const allTestimonials = await exports.getCachedOrTranslated('testimonials:all', targetLang, async () => {
        const list = await Testimonial.find().sort({ createdAt: -1 });
        return list.map(t => ({
          _id: t._id,
          studentName: t.studentName,
          program: t.program,
          destinationCountry: t.destinationCountry,
          photo: t.photo,
          story: t.story,
          verified: t.verified,
          published: t.published,
          createdAt: t.createdAt
        }));
      });
      
      await exports.getCachedOrTranslated('testimonials:verified', targetLang, () =>
        Testimonial.find({ verified: true, published: true }).sort({ createdAt: -1 })
      );
      
      if (Array.isArray(allTestimonials)) {
        for (const item of allTestimonials) {
          await exports.getCachedOrTranslated(`testimonial:${item._id}`, targetLang, async () => {
            const t = await Testimonial.findById(item._id);
            if (!t) return null;
            return {
              _id: t._id,
              studentName: t.studentName,
              program: t.program,
              destinationCountry: t.destinationCountry,
              photo: t.photo,
              story: t.story,
              verified: t.verified,
              published: t.published,
              createdAt: t.createdAt
            };
          });
        }
      }
      break;
    }

    case 'program': {
      const Program = getModel('Program');
      if (!Program) return;
      
      const allPrograms = await exports.getCachedOrTranslated('programs:all', targetLang, () =>
        Program.find().sort({ createdAt: -1 })
      );
      
      await exports.getCachedOrTranslated('programs:published', targetLang, () =>
        Program.find({ isPublished: true }).sort({ createdAt: -1 })
      );
      
      if (Array.isArray(allPrograms)) {
        for (const item of allPrograms) {
          await exports.getCachedOrTranslated(`program:${item._id}`, targetLang, () =>
            Program.findById(item._id)
          );
          if (item.slug && item.isPublished) {
            await exports.getCachedOrTranslated(`program:slug:${item.slug}`, targetLang, () =>
              Program.findOne({ slug: item.slug, isPublished: true })
            );
          }
        }
      }
      break;
    }

    case 'course': {
      const Course = getModel('Course');
      if (!Course) return;
      
      const allCourses = await exports.getCachedOrTranslated('courses:all', targetLang, () =>
        Course.find().sort({ createdAt: -1 })
      );
      
      if (Array.isArray(allCourses)) {
        for (const item of allCourses) {
          await exports.getCachedOrTranslated(`course:${item._id}`, targetLang, () =>
            Course.findById(item._id)
          );
        }
      }
      break;
    }

    case 'event': {
      const Event = getModel('Event');
      if (!Event) return;
      
      await exports.getCachedOrTranslated('events:all', targetLang, () =>
        Event.find().sort({ date: -1 })
      );
      
      await exports.getCachedOrTranslated('events:published', targetLang, () =>
        Event.find({ status: { $ne: 'Draft' } }).sort({ date: 1 })
      );
      break;
    }

    case 'library': {
      const LibraryItem = getModel('LibraryItem');
      if (!LibraryItem) return;
      
      await exports.getCachedOrTranslated('library:all:all', targetLang, () =>
        LibraryItem.find()
          .populate('studyLanguage', 'name code')
          .populate('uploadedBy', 'firstName lastName')
          .sort({ createdAt: -1 })
      );
      
      const items = await LibraryItem.find();
      const languages = Array.from(new Set(items.filter(i => i.studyLanguage).map(i => i.studyLanguage.toString())));
      const types = Array.from(new Set(items.filter(i => i.type).map(i => i.type)));
      
      for (const langId of languages) {
        await exports.getCachedOrTranslated(`library:${langId}:all`, targetLang, () =>
          LibraryItem.find({ studyLanguage: langId })
            .populate('studyLanguage', 'name code')
            .populate('uploadedBy', 'firstName lastName')
            .sort({ createdAt: -1 })
        );
        for (const t of types) {
          await exports.getCachedOrTranslated(`library:${langId}:${t}`, targetLang, () =>
            LibraryItem.find({ studyLanguage: langId, type: t })
              .populate('studyLanguage', 'name code')
              .populate('uploadedBy', 'firstName lastName')
              .sort({ createdAt: -1 })
          );
        }
      }
      for (const t of types) {
        await exports.getCachedOrTranslated(`library:all:${t}`, targetLang, () =>
          LibraryItem.find({ type: t })
            .populate('studyLanguage', 'name code')
            .populate('uploadedBy', 'firstName lastName')
            .sort({ createdAt: -1 })
        );
      }
      break;
    }

    case 'research': {
      const Research = getModel('Research');
      if (!Research) return;
      
      const allResearch = await exports.getCachedOrTranslated('research:all', targetLang, () =>
        Research.find({})
          .populate('institute', 'name')
          .populate('authors', 'firstName lastName')
      );
      
      if (Array.isArray(allResearch)) {
        for (const item of allResearch) {
          await exports.getCachedOrTranslated(`research:${item._id}`, targetLang, () =>
            Research.findById(item._id)
              .populate('institute', 'name')
              .populate('authors', 'firstName lastName')
          );
        }
      }
      break;
    }

    case 'institute': {
      const Institute = getModel('Institute');
      if (!Institute) return;
      
      const allInstitutes = await exports.getCachedOrTranslated('institutes:all', targetLang, () =>
        Institute.find().sort({ createdAt: -1 })
      );
      
      if (Array.isArray(allInstitutes)) {
        for (const item of allInstitutes) {
          await exports.getCachedOrTranslated(`institute:${item._id}`, targetLang, () =>
            Institute.findById(item._id)
          );
        }
      }
      break;
    }

    case 'activity': {
      const Activity = getModel('Activity');
      if (!Activity) return;
      
      await exports.getCachedOrTranslated('activities:all', targetLang, () =>
        Activity.find().populate('staffId', 'firstName lastName email').sort({ createdAt: -1 })
      );
      break;
    }

    case 'quiz': {
      const Quiz = getModel('Quiz');
      if (!Quiz) return;
      
      const quizzes = await Quiz.find();
      if (Array.isArray(quizzes)) {
        for (const q of quizzes) {
          const sanitizedQuiz = {
            _id: q._id,
            title: q.title,
            description: q.description,
            libraryItem: q.libraryItem,
            questions: q.questions.map(qItem => ({
              _id: qItem._id,
              questionText: qItem.questionText,
              options: qItem.options
            }))
          };
          await exports.getCachedOrTranslated(`quiz:item:${q.libraryItem}`, targetLang, () => sanitizedQuiz);
        }
      }
      break;
    }

    default: {
      // Check for dynamic quiz:item: prefix
      if (prefix && prefix.startsWith('quiz:item:')) {
        const libraryItem = prefix.replace('quiz:item:', '');
        const Quiz = getModel('Quiz');
        if (!Quiz) return;
        
        const q = await Quiz.findOne({ libraryItem });
        if (q) {
          const sanitizedQuiz = {
            _id: q._id,
            title: q.title,
            description: q.description,
            libraryItem: q.libraryItem,
            questions: q.questions.map(qItem => ({
              _id: qItem._id,
              questionText: qItem.questionText,
              options: qItem.options
            }))
          };
          await exports.getCachedOrTranslated(`quiz:item:${libraryItem}`, targetLang, () => sanitizedQuiz);
        }
      }
      break;
    }
  }
};

exports.warmupAll = async () => {
  console.log('🔥 Initializing dynamic database pre-translation cache warm-up...');
  for (const prefix of WARMUP_PREFIXES) {
    try {
      await exports.warmupCollection(prefix);
    } catch (err) {
      console.error(`⚠️ Failed to pre-cache prefix "${prefix}" during warm-up:`, err.message);
    }
  }
  console.log('✅ All translations pre-cached successfully.');
};

exports.invalidateCache = async (prefix) => {
  if (redisClient && redisClient.status === 'ready') {
    try {
      const keys = await redisClient.keys(`translation:${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(`Successfully invalidated Redis cache keys for prefix "${prefix}" (${keys.length} keys)`);
      }
      
      // Asynchronously trigger targeted cache warm-up in background
      setImmediate(() => {
        exports.warmupCollection(prefix).catch(err => {
          console.error(`⚠️ Error warming up collection "${prefix}" in background:`, err.message);
        });
      });
    } catch (e) {
      console.error(`Error invalidating Redis cache for prefix "${prefix}":`, e.message);
    }
  }
};
