#!/bin/bash
set -e

# Base URL
API_URL="http://localhost:5001/api"
DUMMY_IMG="dummy_files/dummy.jpg"
DUMMY_PDF="dummy_files/dummy.pdf"

echo "Retrieving superadmin token..."
TOKEN=$(node seed_token.js)
echo "Token: $TOKEN"

HEADERS="-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'"

echo "--- Seeding Users ---"
curl -s -X POST $API_URL/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"student@einstein.com","password":"password123","role":"student"}'

echo ""
echo "--- Seeding Study Languages ---"
curl -s -X POST $API_URL/study-languages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Allemand", "code":"de"}'

LANG_ID=$(curl -s $API_URL/study-languages | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4)
echo "Language ID: $LANG_ID"

echo ""
echo "--- Seeding Institutes ---"
curl -s -X POST $API_URL/institutes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Douala Campus" \
  -F "location=Douala" \
  -F "description=Main campus" \
  -F "contactEmail=douala@einstein.com" \
  -F "contactPhone=123456789" \
  -F "logo=@$DUMMY_IMG"

INST_ID=$(curl -s $API_URL/institutes | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4)
echo "Institute ID: $INST_ID"

echo ""
echo "--- Seeding Courses ---"
curl -s -X POST $API_URL/courses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=German A1" \
  -F "description=Beginner German" \
  -F "studyLanguage=$LANG_ID" \
  -F "thumbnail=@$DUMMY_IMG"

echo ""
echo "--- Seeding Library Items ---"
curl -s -X POST $API_URL/library \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=A1 Vocabulary" \
  -F "description=Basic words" \
  -F "type=document" \
  -F "studyLanguage=$LANG_ID" \
  -F "file=@$DUMMY_PDF"

echo ""
echo "--- Seeding Programs ---"
curl -s -X POST $API_URL/programs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=Nursing Ausbildung" \
  -F "description=Study nursing in Germany" \
  -F "duration=3 years" \
  -F "requirements=B2 German" \
  -F "thumbnail=@$DUMMY_IMG"

echo ""
echo "--- Seeding Research ---"
curl -s -X POST $API_URL/research \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=Language Acquisition Study" \
  -F "abstract=How fast students learn." \
  -F "authors=Dr. Smith" \
  -F "publicationDate=2026-05-01" \
  -F "document=@$DUMMY_PDF"

echo ""
echo "--- Seeding Events ---"
curl -s -X POST $API_URL/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "title=Summer Meetup" \
  -F "description=Meet and greet" \
  -F "date=2026-06-15T10:00:00Z" \
  -F "location=Main Hall" \
  -F "capacity=100" \
  -F "image=@$DUMMY_IMG"

echo ""
echo "--- Seeding Activities ---"
curl -s -X POST $API_URL/activities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Speaking Practice", "type":"Task", "date":"2026-05-20", "status":"pending"}'

echo ""
echo "--- Seeding Partners ---"
curl -s -X POST $API_URL/partners \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Goethe Institute" \
  -F "type=Institution" \
  -F "description=Language testing" \
  -F "logo=@$DUMMY_IMG"

echo ""
echo "--- Seeding Testimonials ---"
curl -s -X POST $API_URL/testimonials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "authorName=John Student" \
  -F "course=German B2" \
  -F "content=Great school!" \
  -F "rating=5" \
  -F "isApproved=true" \
  -F "avatar=@$DUMMY_IMG"

echo ""
echo "--- Seeding Leads ---"
curl -s -X POST $API_URL/crm/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"New","lastName":"Lead","email":"lead@example.com","phone":"123123123","status":"new","source":"website"}'

echo ""
echo "Done seeding data!"
