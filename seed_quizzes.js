const mongoose = require('mongoose');
const dotenv = require('dotenv');
const LibraryItem = require('./src/isolated/models/LibraryItem');
const Quiz = require('./src/isolated/models/Quiz');

dotenv.config({ override: true });

async function seedQuizzes() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB.');

    // Clear existing quizzes first to ensure clean seed
    await Quiz.deleteMany({});
    console.log('🗑️ Cleared existing quizzes.');

    // Fetch all library items
    const libraryItems = await LibraryItem.find();
    if (libraryItems.length === 0) {
      console.log('⚠️ No library items found in database. Please seed library data first.');
      process.exit(0);
    }

    console.log(`📚 Found ${libraryItems.length} library items. Seeding quizzes...`);

    let seedCount = 0;

    for (const item of libraryItems) {
      // Determine language based on title/metadata
      const isGerman = item.title.toLowerCase().includes('deutsch') || 
                       item.title.toLowerCase().includes('all') || 
                       item.title.toLowerCase().includes('de') || 
                       item.title.toLowerCase().includes('german');
      
      let questions = [];
      
      if (isGerman) {
        questions = [
          {
            questionText: 'Welcher Artikel gehört zu "Hund"?',
            options: ['Der', 'Die', 'Das', 'Den'],
            correctOptionIndex: 0,
            explanation: 'Das Substantiv "Hund" ist maskulin, daher heißt es "der Hund".'
          },
          {
            questionText: 'Wie sagt man "Thank you" auf Deutsch?',
            options: ['Bitte', 'Hallo', 'Danke', 'Tschüss'],
            correctOptionIndex: 2,
            explanation: '"Danke" ist die deutsche Übersetzung für "Thank you".'
          },
          {
            questionText: 'Ergänzen Sie: "Ich ______ Deutsch lernen."',
            options: ['willst', 'wollen', 'will', 'wollt'],
            correctOptionIndex: 2,
            explanation: 'Die erste Person Singular von "wollen" ist "ich will".'
          }
        ];
      } else {
        // French / General grammar quiz
        questions = [
          {
            questionText: 'Quel est l\'article correct pour "ordinateur"?',
            options: ['La', 'Le', 'Les', 'Une'],
            correctOptionIndex: 1,
            explanation: '"Ordinateur" est un nom masculin singulier, on dit donc "le" ou "l\'ordinateur".'
          },
          {
            questionText: 'Traduisez: "How are you?" en français.',
            options: ['Comment ça va ?', 'Enchanté', 'Au revoir', 'S\'il vous plaît'],
            correctOptionIndex: 0,
            explanation: '"Comment ça va ?" est la formule courante pour demander comment va quelqu\'un.'
          },
          {
            questionText: 'Complétez : "Nous ______ à l\'Institut Einstein."',
            options: ['étudiez', 'étudions', 'étudient', 'étudie'],
            correctOptionIndex: 1,
            explanation: 'La terminaison de la première personne du pluriel (nous) au présent est "-ons", soit "étudions".'
          }
        ];
      }

      const quiz = new Quiz({
        title: `Quiz d'Évaluation : ${item.title}`,
        description: `Testez votre niveau de grammaire, de vocabulaire et de compréhension de lecture associé au document "${item.title}". Obtenez au moins 70% pour réussir !`,
        libraryItem: item._id,
        questions
      });

      await quiz.save();
      seedCount++;
    }

    console.log(`🎉 Successfully seeded ${seedCount} quizzes for all library items!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedQuizzes();
