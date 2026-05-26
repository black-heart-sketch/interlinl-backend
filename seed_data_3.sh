#!/bin/bash
set -e

# Base URL
API_URL="http://localhost:5001/api"
DUMMY_IMG="dummy_files/dummy.jpg"
DUMMY_PDF="dummy_files/dummy.pdf"

TOKEN=$(node seed_token.js)

echo "--- Seeding Partners ---"
curl -s -X POST $API_URL/partners \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Goethe Institute", "type":"institution", "country":"Germany", "email":"contact@goethe.de", "website":"https://goethe.de"}'

echo ""
echo "--- Seeding Testimonials ---"
curl -s -X POST $API_URL/testimonials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentName":"John Student", "course":"German B2", "story":"Great school!", "published":true}'

echo ""
echo "--- Seeding Research ---"
curl -s -X POST $API_URL/research \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=Language Acquisition Study" \
  -F "description=How fast students learn." \
  -F 'authors=["Dr. Smith"]' \
  -F "documents=@$DUMMY_PDF"

echo ""
echo "Done final seeding!"
