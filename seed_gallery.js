const mongoose = require('mongoose');
const MediaAsset = require('./src/models/MediaAsset');
require('dotenv').config({ override: true });

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/InstituteEinsteins';
mongoose.connect(uri);

async function run() {
  await MediaAsset.deleteMany({ type: 'photo' });
  
  const images = [
    {
      title: 'Cérémonie de Remise des Diplômes',
      description: 'Célébration des réussites de nos étudiants exceptionnels de la promotion 2025.',
      type: 'photo',
      url: '/media/gallery_1.png',
      status: 'Live'
    },
    {
      title: 'Bibliothèque Universitaire',
      description: 'Un espace de calme et de concentration pour approfondir ses connaissances.',
      type: 'photo',
      url: '/media/gallery_2.jpg',
      status: 'Live'
    },
    {
      title: 'Campus Principal',
      description: 'Notre infrastructure moderne conçue pour un apprentissage optimal.',
      type: 'photo',
      url: '/media/gallery_3.jpg',
      status: 'Live'
    },
    {
      title: 'Étudiants en Classe',
      description: 'Des sessions interactives qui favorisent la participation de tous.',
      type: 'photo',
      url: '/media/gallery_4.jpg',
      status: 'Live'
    },
    {
      title: 'Laboratoire de Langues',
      description: 'Pratique intensive avec des équipements audio de dernière génération.',
      type: 'photo',
      url: '/media/gallery_5.jpg',
      status: 'Live'
    },
    {
      title: 'Discussion de Groupe',
      description: 'Échanges enrichissants entre étudiants de diverses nationalités.',
      type: 'photo',
      url: '/media/gallery_6.jpg',
      status: 'Live'
    }
  ];

  for (const img of images) {
    await MediaAsset.create(img);
  }
  
  console.log('Successfully re-seeded gallery images with simple French strings.');
  process.exit(0);
}

run();
