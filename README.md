# AI-Powered Social Matching Platform for Persons with Disabilities

This is a Node.js application designed to power a social matching platform for persons with disabilities (PWDs). The platform connects PWDs with each other and volunteers to provide assistance based on requests. The backend is built using Node.js, Express, and PostgreSQL, with a simple frontend using vanilla HTML, CSS, and JavaScript. The application also integrates with Azure for serverless solutions.

## Features

- **User Authentication**: Handles registration, login, and user management.
- **Social Matching Algorithm**: Matches users (PWDs) with volunteers and other PWDs based on needs and available assistance.
- **Notifications**: Sends notifications about matchings and requests.
- **Post Creation**: Users can create posts for assistance requests.

## Setup

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL
- Azure account (for deploying the backend)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/social-matching-platform.git
   cd social-matching-platform

2.	Install dependencies:

    ```bash
    npm install

3.	Set up the database:
•	Create a PostgreSQL database and configure the connection in /config/db.js.
•	You will need to create tables for users, posts, and matches based on the models.

# Running the application locally (For now)

    ```bash
    npm start