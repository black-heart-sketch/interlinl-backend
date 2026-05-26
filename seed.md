# 🌱 Institute Einsteins – Database Seed Credentials

Welcome to the **Institute Einsteins** environment setup! Below you will find the complete list of pre-seeded user credentials designed to represent all user archetypes and roles within the application ecosystem.

---

## 🔑 Default User Accounts

> [!IMPORTANT]
> The default password for **all** pre-seeded accounts listed below is:
> **`password123`**

| Role | Full Name | Email Address | Description & Access Level |
| :--- | :--- | :--- | :--- |
| **`superadmin`** | Super Admin | `superadmin@einstein.com` | Root system operator with unrestricted master permissions across all campuses, users, and core system modules. |
| **`admin`** | Albert Einstein | `admin@einstein.com` | Campus administrator, manages local courses, programs, leads, events, activities, and testimonials. |
| **`teacher`** | John Teacher | `teacher@einstein.com` | Academic instructor, manages course contents, quizzes, curriculum material, and library items. |
| **`advisor`** | Sarah Advisor | `advisor@einstein.com` | Student advisor, handles CRM leads, parent interactions, and guidance counseling workflows. |
| **`student`** | Jane Doe | `student@einstein.com` | Enrolled active student. Associated with **German A1/A2/B1** courses and has active progress in the LMS. |
| **`partner`** | Goethe Partner | `partner@einstein.com` | External institutional partner (e.g. Goethe-Institut, Telc GmbH) with access to student metrics and program placement pipelines. |
| **`public`** | Paul Public | `public@einstein.com` | Registered public portal user, exploring educational resources and event schedules. |

---

## 🛠️ How to Re-Seed the Database

If you ever need to reset or refresh the database to its pristine default state, run the master seeding suite:

### 1. Prerequisite
Ensure your local MongoDB instance is running. By default, it connects to:
`mongodb://127.0.0.1:27017/InstituteEinsteins` (or as defined by `MONGO_URI` in your `.env` file).

### 2. Command Execution
Navigate to your backend directory and run:
```bash
cd InstituteEinsteins2.0_backend
npm run seed
```

This master seed runner executes all individual DB seeds in sequence:
1. `seed_admin.js` — Seeds all user roles listed above.
2. `seed_data.js` — Seeds languages, institutes, courses, programs, events, partners, and CRM leads.
3. `seed_gallery.js` — Seeds mock assets and media gallery content.
4. `seed_quizzes.js` — Seeds interactive quizzes associated with library items.
5. `seed_testimonials.js` — Downloads student portraits and seeds verified student stories.
