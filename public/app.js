const API_URL = 'http://localhost:3000/api/todos';

document.addEventListener("DOMContentLoaded", () => {
    const addButton = document.getElementById("addButton");
    const taskInput = document.getElementById("taskInput");
    const searchInput = document.getElementById("searchInput");
    const clearSearchButton = document.getElementById("clearSearch");
    const taskList = document.getElementById("taskList");

    let editTimeout;

    // Enable Add button only when input is not empty
    /*
    taskInput.addEventListener("input", () => {
        addButton.disabled = taskInput.value.trim() === "";
    });
    */

    // Handle adding new task
    addButton.addEventListener("click", async () => {
        const taskText = taskInput.value.trim();
        if (!taskText) return;

        const newTask = { text: taskText };
        
        // Add task to MongoDB
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTask),
        });

        if (response.ok) {
            taskInput.value = "";
            taskInput.focus();
            //addButton.disabled = true;

            // Update UI by adding the task to the list
            const task = await response.json();
            const taskCard = createTaskCard(task);
            taskList.prepend(taskCard);
        }
    });

    // Function to create a task card dynamically
    function createTaskCard(task) {
        const card = document.createElement("div");
        card.classList.add("card");
        card.id = `task-${task._id}`; // Add ID to card for easier removal

        // Calculate font size based on task text length
        const textLength = task.text.length;
        const minFontSize = 14;  // Minimum font size (px)
        const maxFontSize = 28;  // Maximum font size (px)
        
        // The font size will be inversely proportional to the text length
        const fontSize = Math.max(
            minFontSize,
            Math.min(maxFontSize, (maxFontSize - minFontSize) * (100 - textLength) / 100 + minFontSize)
        );
       
        card.innerHTML = `
            <div class="text" style="font-size: ${fontSize}px;">${task.text}</div>
            <button class="delete-btn" data-id="${task._id}">Delete</button>
        `;

        // Add click event for editing
        //card.addEventListener("click", () => openEditModal(task));

        // Add event listener to the delete button
        const deleteButton = card.querySelector(".delete-btn");
        deleteButton.addEventListener("click", () => {
            deleteTask(task._id); // Pass the task ID when clicked
        });

        return card;
    }

    // Open edit modal
    function openEditModal(task) {
        const modal = document.createElement("div");
        modal.classList.add("modal");
        modal.innerHTML = `
            <div class="modal-content">
                <textarea class="edit-input">${task.text}</textarea>
                <button class="close-btn">×</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        const editInput = modal.querySelector(".edit-input");
        const closeButton = modal.querySelector(".close-btn");

        editInput.focus();

        // Auto-save after typing
        editInput.addEventListener("input", () => {
            clearTimeout(editTimeout);
            editTimeout = setTimeout(() => updateTask(task._id, editInput.value), 300);
        });

        // Close modal
        closeButton.addEventListener("click", () => {
            modal.remove();
        });
    }

    // Update task
    async function updateTask(taskId, newText) {
        const response = await fetch(`${API_URL}/${taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: newText }),
        });

        if (response.ok) {
            const updatedTask = await response.json();
            const taskCard = document.querySelector(`#task-${taskId} .text`);
            taskCard.textContent = updatedTask.text;
        }
    }

    // Fetch existing tasks on page load
    async function loadTasks() {
        const response = await fetch(API_URL);
        if (!response.ok) {
            console.error("Failed to load tasks:", response.statusText);
            return;
        }
        const tasks = await response.json();
        // Clear the task list with transition
        taskList.classList.add("fade-out");

        setTimeout(() => {
            taskList.innerHTML = ''; // Clear existing tasks
            taskList.classList.remove("fade-out");

            tasks.reverse().forEach((task) => {
                const taskCard = createTaskCard(task);
                taskList.appendChild(taskCard);
            });
        }, 200); // .5s transition to hide the tasks before loading new ones
    }

    loadTasks();

    let debounceTimeout;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim();

         // Toggle the visibility of the "X" button
        clearSearchButton.style.display = query ? "block" : "none";

        if (query === "") {
            loadTasks(); // Load all tasks if search is empty
            return;
        }

        // Clear the previous timeout if the user is typing again
        clearTimeout(debounceTimeout);

        // Add .5s delay before performing the search after the user stops typing
        debounceTimeout = setTimeout(async () => {
            const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) {
                console.error("Search error:", response.statusText);
                return;
            }

            const results = await response.json();

            // Clear the existing task list with transition
            taskList.classList.add("fade-out");
            
            setTimeout(() => {
                taskList.innerHTML = ''; // Clear the list after fade-out
                taskList.classList.remove("fade-out");

                // Display search results with transition
                results.forEach((task) => {
                    const taskCard = createTaskCard(task);
                    taskList.appendChild(taskCard);
                });
            }, 200); // Match the delay to fade-out transition time
        }, 200); // Wait for 500ms after the user stops typing
    });
    
    // Clear the search input when the "X" button is clicked
    clearSearchButton.addEventListener("click", () => {
        searchInput.value = "";
        clearSearchButton.style.display = "none"; // Hide the "X" button
        loadTasks(); // Load all tasks again when search is cleared
    });

    // Delete task
    async function deleteTask(taskId) {
        if (!taskId) {
            console.error('Invalid task ID:', taskId);
            return;
        }

        const response = await fetch(`${API_URL}/${taskId}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            console.error('Failed to delete task:', response.statusText);
            return;
        }

        const taskCard = document.querySelector(`#task-${taskId}`);
        if (!taskCard) {
            console.error('Task card not found:', taskId);
            return;
        }

        // Fade out task before removing
        taskCard.classList.add("fade-out");

        setTimeout(() => {
            taskCard.remove(); // Remove task after fade-out transition
        }, 200); // Match the delay to fade-out transition time
    }
});

// Load themes
async function loadThemes() {
    try {
        const response = await fetch('/api/themes');
        const themes = await response.json();
        const themeContainer = document.getElementById('themeContainer');

        themeContainer.innerHTML = '';

        themes.forEach(theme => {
            const button = document.createElement('button');
            button.classList.add('theme-btn');
            button.textContent = `Theme: ${theme._id}`;
            button.addEventListener('click', () => loadTasksByTheme(theme._id));
            themeContainer.appendChild(button);
        });
    } catch (error) {
        console.error("Error loading themes:", error);
    }
}

// Load tasks by theme
async function loadTasksByTheme(theme) {
    try {
        const response = await fetch(`/api/themes/${encodeURIComponent(theme)}`);
        const tasks = await response.json();
        taskList.innerHTML = '';

        tasks.forEach((task) => {
            const taskCard = createTaskCard(task);
            taskList.appendChild(taskCard);
        });
    } catch (error) {
        console.error("Error loading tasks by theme:", error);
    }
}

loadThemes();