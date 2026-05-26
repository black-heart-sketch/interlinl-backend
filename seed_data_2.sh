#!/bin/bash
set -e

# Base URL
API_URL="http://localhost:5001/api"
DUMMY_IMG="dummy_files/dummy.jpg"
DUMMY_PDF="dummy_files/dummy.pdf"

TOKEN=$(node seed_token.js)

echo "--- Seeding Research ---"
curl -s -X POST $API_URL/research \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=Language Acquisition Study" \
  -F "abstract=How fast students learn." \
  -F "authors=Dr. Smith" \
  -F "publicationDate=2026-05-01" \
  -F "documents=@$DUMMY_PDF"

echo ""
echo "--- Seeding Activities ---"
curl -s -X POST $API_URL/activities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Speaking Practice", "category":"Speaking", "duration":"09:00 - 10:30", "status":"Active"}'

echo ""
echo "--- Seeding Partners ---"
curl -s -X POST $API_URL/partners \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Goethe Institute" \
  -F "type=institution" \
  -F "country=Germany" \
  -F "logo=@$DUMMY_IMG"

echo ""
echo "--- Seeding Testimonials ---"
curl -s -X POST $API_URL/testimonials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "studentName=John Student" \
  -F "course=German B2" \
  -F "story=Great school!" \
  -F "published=true"

echo ""
echo "--- Seeding Leads ---"
curl -s -X POST $API_URL/crm/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"New Lead","email":"lead@example.com","phone":"123123123","status":"new","source":"website"}'

echo ""
echo "Done seeding remaining data!"
