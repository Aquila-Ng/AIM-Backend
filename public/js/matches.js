// Example list of matched users (replace this with data fetched from your database)
const matchedUsers = [
    {
        firstName: "John",
        lastName: "Doe",
        age: 28,
        sex: "Male",
        height: "180 cm",
        weight: "75 kg",
        blindVisionDifficulty: "No",
        deafHearingDifficulty: "No",
        difficultyWalking: "No"
    },
    {
        firstName: "Jane",
        lastName: "Smith",
        age: 25,
        sex: "Female",
        height: "165 cm",
        weight: "60 kg",
        blindVisionDifficulty: "Yes",
        deafHearingDifficulty: "No",
        difficultyWalking: "No"
    }
];

// Function to render matched user cards
function renderMatches(users) {
    const container = document.getElementById('matches-container');
    users.forEach(user => {
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-4';
        card.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${user.firstName} ${user.lastName}</h5>
                    <p class="card-text"><strong>Age:</strong> ${user.age}</p>
                    <p class="card-text"><strong>Sex:</strong> ${user.sex}</p>
                    <p class="card-text"><strong>Height:</strong> ${user.height}</p>
                    <p class="card-text"><strong>Weight:</strong> ${user.weight}</p>
                    <p class="card-text"><strong>Blind/Vision Difficulty:</strong> ${user.blindVisionDifficulty}</p>
                    <p class="card-text"><strong>Deaf/Hearing Difficulty:</strong> ${user.deafHearingDifficulty}</p>
                    <p class="card-text"><strong>Difficulty Walking:</strong> ${user.difficultyWalking}</p>
                    <a href="/chat/${user.firstName}-${user.lastName}" class="btn btn-primary">Chat</a>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Render the cards on page load
renderMatches(matchedUsers);