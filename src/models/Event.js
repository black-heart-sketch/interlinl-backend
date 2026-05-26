const mongoose = require('mongoose');

const speakerTestimonialSchema = new mongoose.Schema({
  text: String,
  author: String,
  role: String
});

const speakerSchema = new mongoose.Schema({
  name: String,
  role: String,
  image: String,
  message: String,
  quote: String,
  extra_info: String,
  highlights: [String],
  testimonials: [speakerTestimonialSchema]
});

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['event', 'conference', 'webinar', 'exam', 'workshop', 'seminar'], 
      default: 'event' 
    },
    typeColor: { type: String, default: '#3b82f6' },
    date: { type: Date, required: true },
    endDate: { type: Date },
    time: { type: String },
    location: { type: String, required: true },
    capacity: { type: Number, default: 0 },
    attendees: { type: Number, default: 0 },
    speakers: [speakerSchema],
    description: { type: String },
    image: { type: String },
    badge: { type: String },
    badgeColor: { type: String, default: '#10b981' },
    gallery: [{ type: String }],
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Scheduled', 'Past', 'Live'],
      default: 'Draft'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
