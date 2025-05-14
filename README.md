# AIM-Backend

## Introduction 

AIM-Backend is the server-side application for an AI-powered social matching platform designed to connect Persons with Disabilities (PWDs) with volunteers and peers. Built with Node.js, Express, and PostgreSQL, it facilitates user authentication, request management, and intelligent matching.


### Features

	•	User Authentication: Secure registration and login functionalities.
	•	Social Matching Algorithm: Connects PWDs with suitable volunteers or peers based on assistance needs.
	•	Assistance Requests: Users can create and manage posts requesting help.
	•	Notifications: Alerts users about matches and updates.
	•	Frontend Interface: Simple UI using vanilla HTML and CSS.
	•	External API Integrations:
	•	Google Gemini API: Enhances AI-driven matching capabilities.
	•	Azure Maps API: Provides geolocation services for better matching based on proximity.

### Technologies Used
	•	Backend: Node.js, Express.js
	•	Database: PostgreSQL
	•	Frontend: Vanilla HTML & CSS
	•	External APIs: Google Gemini API, Azure Maps API
	•	Deployment: Azure serverless solutions ￼

## Installation Guide


### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/social-matching-platform.git
   cd social-matching-platform

2.	Install dependencies:

    ```bash
    npm install

3.	Configure Enviromental Variables:

    DB_USER=your_user
    DB_HOST=your_host
    DB_DATABASE=aim (OR your prefered database name)
    DB_PASSWORD=your_password
    DB_PORT=your_db_port

    PORT=your_host_port
    JWT_SECRET=your_jwt_secret
    GEMINI_API_KEY=your_gemini_api_key
    AZURE_MAPS_KEY=your_azure_maps_api_key

Replace username, password, your_jwt_secret, your_google_gemini_api_key, and your_azure_maps_api_key with your actual PostgreSQL credentials and API keys.

    Note: Both the Google Gemini API and Azure Maps API require valid accounts and API keys. Ensure you have registered and obtained these credentials before proceeding.

4. Set Up the Database

- Create a new PostGreSQL database named aim (OR your prefered database name)
- Run the SQL scripts located in the config directory to set up the necessary tables and relationships

5. Start the server

    ```bash
    npm start

## Project Structure

    AIM-Backend/
    ├── config/          # Database configuration and SQL scripts
    ├── controllers/     # Route handlers and business logic
    ├── middleware/      # Custom middleware functions
    ├── models/          # Database models
    ├── public/          # Static frontend files (HTML, CSS)
    ├── routes/          # API route definitions
    ├── .gitignore
    ├── package.json
    ├── README.md
    └── server.js        # Entry point of the application

## Scripts

- Start server: npm start
- Install dependencies: npm install

## License

This project is licensed under the MIT License. See the LICENSE file for details.