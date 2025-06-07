# Patient Management System (Flask & MongoDB)

## Project Overview
This is a full-stack web application designed to demonstrate efficient patient record management within a healthcare context. It provides a secure, centralized system for managing patient data, streamlining administrative tasks, and offering basic analytical insights.

## Features
- **User Authentication & Authorization:** Secure login for different user roles (e.g., doctor, admin) using JWT (JSON Web Tokens) and Flask-JWT-Extended.
- **Role-Based Access Control (RBAC):** Restricts certain actions (like delete) based on user roles.
- **Patient CRUD Operations:**
  - **Create:** Add new patient records with detailed personal and medical information.
  - **Read:** View a comprehensive list of all registered patients.
  - **Update:** Edit existing patient details through an intuitive form.
  - **Delete:** Remove patient records from the system (with confirmation).
- **Patient Search:** Efficiently search for patients by name or their unique patient ID.
- **Analytics Dashboard:** Visual representation of key patient data using Chart.js, including:
  - Gender Distribution
  - Department Distribution
  - Frequent Visitors (demonstrative)
- **Responsive UI:** Built with standard HTML, CSS, and vanilla JavaScript for a dynamic user experience.

## Technology Stack
- **Backend:** Python, Flask (Web Framework)
- **Database:** MongoDB (NoSQL Database)
- **Database ORM/Driver:** PyMongo
- **Authentication:** Flask-JWT-Extended
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Charting Library:** Chart.js
