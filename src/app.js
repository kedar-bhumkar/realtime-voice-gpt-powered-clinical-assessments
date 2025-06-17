import { OpenAI } from  "https://esm.sh/openai";

const tools = [{
    "type": "function",
    "name": "handleSave",
    "description": "Handle the save action. Call this function when the users asks to save the assessment",
    "parameters": {
    }
},{
    "type": "function",
    "name": "handleCancel",
    "description": "Handle the cancel action. Call this function when the users asks to cancel the assessment or they mention reset the assessments or reset all answers",
    "parameters": {
    }
}
];




// 1. DATA AND CONSTANTS
const SECTIONS = [{
    "name": "DSNP core",
    "questions": [
        {
            "id": "q1",
            "text": "Does the enrollee or caregiver agree to be interviewed?",
            "type": "radio",
            "answers": [
                { "id": "1", "text": "Yes" },
                { "id": "2", "text": "No" }
            ],
            "instruction": "If Response is equal to Yes then answer Group '.'"
        },
        {
            "id": "q2",
            "text": "How was the assessment completed?",
            "type": "radio",
            "answers": [
                { "id": "1", "text": "Telephonic" },
                { "id": "2", "text": "Face to Face" },
                { "id": "3", "text": "Virtual Visit" }
            ]
        },
        {
            "id": "q3",
            "text": "Do you agree to Case Management services?",
            "type": "radio",
            "answers": [
                { "id": "1", "text": "Yes" },
                { "id": "2", "text": "No" }
            ]
        },
        {
            "id": "q4",
            "text": "Primary Care Provider (PCP)",
            "type": "text",
            "instruction": "What is the name of your Primary Care Provider (PCP)?",
            "answer": ""

        },
        {
            "id": "q5",
            "text": "Does member confirm PCP populated from Pathway?",
            "type": "radio",
            "answers": [
                { "id": "1", "text": "Yes" },
                { "id": "2", "text": "No" }
            ],
            "instruction": "If Response is equal to No then answer Question 'a'"
        },
        {
            "id": "q6",
            "text": "In the past 12 months, have you seen your Primary Care Provider/PCP for any reason?",
            "type": "radio",
            "answers": [
                { "id": "1", "text": "Yes" },
                { "id": "2", "text": "No" }
            ],
            "instruction": "If Response is equal to Yes then answer Question 'a'"
        },
        {
            "id": "q7",
            "text": "How would you describe your health?",
            "type": "radio",
            "answers": [
                { "id": "1", "text": "Excellent" },
                { "id": "2", "text": "Good" },
                { "id": "3", "text": "Fair" },
                { "id": "4", "text": "Poor" }
            ]
        },
        {
            "id": "q8",
            "text": "Are you getting medical treatment for any of the following health conditions? (Choose all that apply)",
            "type": "checkbox",
            "answers": [
                { "id": "1", "text": "Asthma/COPD" },
                { "id": "2", "text": "Cancer" },
                { "id": "3", "text": "Diabetes (sugar diabetes) or too much sugar in your blood" },
                { "id": "4", "text": "End stage renal disease (kidney failure)" },
                { "id": "5", "text": "Heart attack or heart problems" },
                { "id": "6", "text": "Heart failure or enlarged heart" },
                { "id": "7", "text": "High blood pressure" },
                { "id": "8", "text": "Mental health condition (anxiety, depression, schizophrenia, bipolar disorder)" },
                { "id": "9", "text": "Obesity" },
                { "id": "10", "text": "Stroke" },
                { "id": "11", "text": "Other" },
                { "id": "12", "text": "None" }
            ],
            "instruction": "If Response is equal to Other then answer Question 'a'"
        }
    ]
}, {
    "name": "PHQ-9",
    "questions": [
        {
            "id": "phq1",
            "text": "Do you have any issues with your sleep?",
            "type": "radio",
            "answers": [        
                { "id": "1", "text": "Not at all" },
                { "id": "2", "text": "Several days" },
                { "id": "3", "text": "More than half the days" },
                { "id": "4", "text": "Nearly every day" }
            ]
        },
        {
            "id": "phq2",
            "text": "Poor appetite or overeating?",
            "type": "radio",
            "answers": [        
                { "id": "1", "text": "Not at all" },
                { "id": "2", "text": "Several days" },
                { "id": "3", "text": "More than half the days" },
                { "id": "4", "text": "Nearly every day" }
            ]
        }
    ]
}];


// Get API key from environment variable
const OPENAI_API_KEY = ""; // Replace with your API key or use a secure method to retrieve it

// Models available: https://github.com/mlc-ai/web-llm
// Select a small, fast model.
//const SELECTED_MODEL = "gemma-2b-it-q4f32_1-MLC"; 
const SELECTED_MODEL = "Qwen3-1.7B";

// 2. DOM ELEMENTS
const recordBtn = document.getElementById('recordBtn');
const statusDiv = document.getElementById('status');
const formContainer = document.getElementById('assessment-form');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveMessage = document.getElementById('saveMessage');

// 3. STATE MANAGEMENT
let openai;
let recognition;
let finalTranscript = '';
let isRecording = false;
let currentSection = null;
let answersState = {};
let processTranscriptCounter = 0;
let mediaStream = null;

// 4. UI FUNCTIONS
function renderSections() {
    const sectionsList = document.getElementById('sections-list');
    let html = '';
    
    console.log('All SECTIONS:', SECTIONS);
    
    SECTIONS.forEach((section, index) => {
        console.log(`Section ${index}:`, section);
        html += `<div class="section-link" data-section="${index}">${section.name}</div>`;
    });
    
    sectionsList.innerHTML = html;

    // Add click event listeners to sections
    document.querySelectorAll('.section-link').forEach(link => {
        link.addEventListener('click', () => {
            // Remove active class from all sections
            document.querySelectorAll('.section-link').forEach(l => l.classList.remove('active'));
            // Add active class to clicked section
            link.classList.add('active');
            // Update current section and render its questions
            const sectionIndex = parseInt(link.getAttribute('data-section'));
            console.log('Selected section index:', sectionIndex);
            currentSection = SECTIONS[sectionIndex];
            console.log('Selected section:', currentSection);
            renderQuestions();
        });
    });

    // Automatically select the first section
    const firstSection = document.querySelector('.section-link');
    if (firstSection) {
        firstSection.click();
    }
}

function renderQuestions() {
    if (!currentSection) {
        console.error('No current section set');
        return;
    }
    
    console.log('Rendering questions for section:', currentSection);
    const sectionKey = Object.keys(currentSection)[0];
    console.log('Section Key:', sectionKey);
    console.log('Section data:', currentSection);
    
    // Access questions directly from currentSection
    const questions = currentSection.questions;
    if (!questions) {
        console.error('No questions found for section:', sectionKey);
        return;
    }
    
    console.log('Questions:', questions);
    let html = '';
    
    questions.forEach(q => {
        html += `<div class="question-block" id="block-${q.id}">`;
        html += `<label class="question-text">${q.text}</label>`;
        if (q.instruction) {
            html += `<div class="question-instruction">${q.instruction}</div>`;
        }
        html += `<div class="answers">`;
        if (q.type === 'radio' && q.answers) {
            q.answers.forEach(a => {
                const checked = answersState[q.id] === a.id ? 'checked' : '';
                html += `<label class="answer-label">
                            <input type="radio" name="${q.id}" value="${a.id}" ${checked}>
                            ${a.text}
                         </label>`;
            });
        } else if (q.type === 'checkbox' && q.answers) {
            q.answers.forEach(a => {
                const checked = Array.isArray(answersState[q.id]) && answersState[q.id].includes(a.id) ? 'checked' : '';
                html += `<label class="answer-label">
                            <input type="checkbox" name="${q.id}" value="${a.id}" ${checked}>
                            ${a.text}
                         </label>`;
            });
        } else if (q.type === 'text') {
            const value = answersState[q.id] || '';
            html += `<input type="text" name="${q.id}" class="text-input" value="${value}" />`;
        }
        html += `</div></div>`;
    });
    
    formContainer.innerHTML = html;

    // Add event listeners for inputs
    document.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"]').forEach(input => {
        input.addEventListener('change', (e) => {
            if (input.type === 'checkbox') {
                // Initialize array if it doesn't exist
                if (!answersState[input.name]) {
                    answersState[input.name] = [];
                }
                if (e.target.checked) {
                    answersState[input.name].push(input.value);
                } else {
                    answersState[input.name] = answersState[input.name].filter(v => v !== input.value);
                }
            } else {
                answersState[input.name] = input.value;
            }
        });
    });
}

function updateStatus(text, type = 'idle') {
    statusDiv.textContent = text;
    statusDiv.className = `status-${type}`;
}

function updateUIWithAnswers(answers) {
    console.log("Updating UI with:", answers);
    
    // Update the answers state
    for (const questionId in answers) {
        const answerId = answers[questionId];
        answersState[questionId] = answerId;
        
        // Find the question element
        const questionBlock = document.getElementById(`block-${questionId}`);
        if (questionBlock) {
            // Add visual feedback
            questionBlock.style.backgroundColor = '#e8f5e9';
            setTimeout(() => { questionBlock.style.backgroundColor = 'transparent'; }, 2000);
            
            // Update the input
            if (Array.isArray(answerId)) {
                // Handle checkbox inputs
                answerId.forEach(val => {
                    const checkbox = questionBlock.querySelector(`input[type="checkbox"][value="${val}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            } else {
                // Handle radio and text inputs
                const input = questionBlock.querySelector(`input[value="${answerId}"]`) ||
                            questionBlock.querySelector('input[type="text"]');
                if (input) {
                    if (input.type === 'text') {
                        input.value = answerId;
                    } else {
                        input.checked = true;
                    }
                }
            }
        }
    }
    
    updateStatus("Assessment updated. Keep speaking or stop.", "listening");
}



/**
 * Handles the save functionality for the assessment form
 * @description This function displays a success message when the assessment is saved and automatically hides it after 3 seconds
 * @example
 * // Example usage:
 * handleSave();
 */
function handleSave() {
    saveMessage.textContent = 'Assessment saved successfully';
    saveMessage.style.display = 'block';
    setTimeout(() => {
        saveMessage.style.display = 'none';
    }, 3000);
}

/**
 * Handles the cancel functionality for the assessment form
 * @description This function resets all radio buttons to an unchecked state and hides the save message
 * @example
 * // Example usage:
 * handleCancel();
 */
function handleCancel() {
    // Reset all radio buttons
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        radio.checked = false;
    });
    saveMessage.style.display = 'none';
}

// 5. LLM AND PROMPT ENGINEERING
async function initializeLLM() {
    updateStatus("Initializing AI model...", "processing");
    
    try {
        openai = new OpenAI({
            apiKey: OPENAI_API_KEY,
            dangerouslyAllowBrowser: true
        });
        
        updateStatus("Model initialized. Ready to start.", "idle");
        recordBtn.disabled = false;
    } catch (err) {
        updateStatus(`Error initializing model: ${err.message}`, "error");
        console.error(err);
    }
}




function createLLMPrompt(transcript) {
    // This is the most critical part: instructing the LLM precisely.
    return `
      You are an expert AI assistant for a clinical setting. Your task is to analyze a on ongoing conversation between a nurse and a patient and fill out an assessment form based on the provided assessment questions and the dialog between the nurse and the patient.
      **ASSESSMENT SECTIONS:**
      ${JSON.stringify(SECTIONS, null, 2)}

      **NURSE'S TRANSCRIPT:**
      "${transcript}"

      
      **INSTRUCTIONS:**
      1. Read the provided transcript carefully. Determine if you need to call a tool or you need to return json of questions and answers. If you are calling a tool, do not execute next steps. 
      2. Based on the transcript, determine the correct answer for each question in the provided JSON structure.
      3. Your output MUST be ONLY a single, valid JSON object.
      4. The JSON object should have question IDs as keys and the corresponding answer IDs as values.
      5. Do not include any explanations, markdown, or text outside of the JSON object.
      6. If an answer cannot be determined from the transcript, omit the question from the output JSON.
               **OUTPUT (JSON ONLY):**
                The output format should be as below
                The JSON object should have question IDs as keys and the corresponding answer IDs as values.
                    It should adhere to the following format:
                    {
                    "questionid1": "answerid1",
                    "questionid2": "answerid2",
                    "questionid3": "answerid3",
                    "questionid4": "answerid4",
                    "questionid5": "answerid5"
                    }


                    E.g. the patient smokes and does not drink
                    {
                        "q2": "1",
                        "q3": "2"
                    }
                    Since there is no mention of other questions, those questions are omitted from the output JSON.
    `;
}

async function processTranscriptWithLLM(transcript) {
    processTranscriptCounter++;
    console.log(`processTranscriptWithLLM called ${processTranscriptCounter} times`);
    
    if (!openai) {
        updateStatus("LLM not initialized.", "error");
        return;
    }
    updateStatus(`Processing: "${transcript}"`, "processing");

    const prompt = createLLMPrompt(transcript);
    console.log("Prompt:", prompt);
    
    try {
        

        const completion = await openai.responses.create({
            model: "gpt-4.1",
            input: [{ role: "user", content: prompt }],
            tools: tools,
            tool_choice: "auto",
            temperature: 0.1 // Low temperature for deterministic output
        });        

        console.log("Completion:", completion.output);
        console.log("Response:", completion.output[0]);
        const type = completion.output[0].type;
        if(type=="function_call"){
            console.log('Executing function call')
            handleFunctionCall(completion.output[0]);
        }else {
            handleUIUpdate(completion.output[0].content[0].text);    
        }
    } catch (error) {
        console.error("Error processing with LLM:", error);
        updateStatus("Couldn't understand the response. Please try rephrasing.", "error");
    }
}

function handleUIUpdate(responseText) {
    console.log('No function call')    
    console.log('Response Text:', responseText);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        const parsedAnswers = JSON.parse(jsonMatch[0]);
        updateUIWithAnswers(parsedAnswers);
        updateStatus("Assessment updated. Keep speaking or stop.", "listening");
    } else {
        throw new Error("No valid JSON found in LLM response.");
    }    
}

function handleFunctionCall(toolCall) {
           
    const name = toolCall.name;
    //const args = JSON.parse(toolCall.content[0].text);    
    const result = callFunction(name, null);
    
}

const callFunction = async (name, args) => {
    console.log('Calling function:', name, args);
    if (name === "handleSave") {
        return handleSave();
    }
    else if (name === "handleCancel") {
        return handleCancel();
    }
    else {
        throw new Error("Invalid function call.");
    }
};

// 6. WEBSOCKET AND MICROPHONE SETUP
let socket;
let microphone;

async function getMicrophone() {
    try {
        // Stop any existing stream
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        
        // Get new stream
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return new MediaRecorder(mediaStream);
    } catch (error) {
        console.error("Error accessing microphone:", error);
        throw error;
    }
}

async function openMicrophone(microphone, socket) {
    return new Promise((resolve) => {
        microphone.onstart = () => {
            console.log("Recording started");
            isRecording = true;
            document.body.classList.add("recording");
            recordBtn.classList.add('recording');
            recordBtn.querySelector('i').className = 'fas fa-stop-circle';
            updateStatus("Listening... Speak now.", "listening");
            finalTranscript = '';
            resolve();
        };

        microphone.onstop = () => {
            console.log("Recording stopped");
            isRecording = false;
            document.body.classList.remove("recording");
            recordBtn.classList.remove('recording');
            recordBtn.querySelector('i').className = 'fas fa-microphone';
            updateStatus("Recording stopped.", "idle");
        };

        microphone.ondataavailable = (event) => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };

        microphone.start(1000);
    });
}

async function closeWebSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("Closing WebSocket connection");
        socket.close();
        socket = null;
    }
}

async function closeMicrophone(microphone) {
    if (microphone) {
        microphone.stop();
        // Stop all tracks in the media stream
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        // Close WebSocket connection
        await closeWebSocket();
        // Reset the final transcript
        finalTranscript = '';
    }
}

function setupWebSocket() {
    // if (socket && socket.readyState !== WebSocket.CLOSED) {
    //     console.log("Closing existing WebSocket connection");
    //     socket.close();
    // }

    socket = new WebSocket("ws://localhost:3000");

    socket.addEventListener("open", async () => {
        console.log("WebSocket connection opened");
        recordBtn.disabled = false;
        updateStatus("Ready to record", "idle");
    });

    socket.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        updateStatus("Connection error. Reconnecting...", "error");
        // Reset recording state
        if (isRecording) {
            isRecording = false;
            if (microphone) {
                closeMicrophone(microphone);
                microphone = null;
            }
            document.body.classList.remove("recording");
            recordBtn.classList.remove('recording');
            recordBtn.querySelector('i').className = 'fas fa-microphone';
        }
    });

    socket.addEventListener("close", () => {
        console.log("WebSocket connection closed");
        updateStatus("WebSocket connection getting closed.");
        recordBtn.disabled = true;
        
        // Reset recording state
        if (isRecording) {
            isRecording = false;
            if (microphone) {
                closeMicrophone(microphone);
                microphone = null;
            }
            document.body.classList.remove("recording");
            recordBtn.classList.remove('recording');
            recordBtn.querySelector('i').className = 'fas fa-microphone';
        }
        
        // Try to reconnect after a delay
        setTimeout(() => {
            //console.log('socket.readyState', socket.readyState);
            //if (socket.readyState === WebSocket.CLOSED) {                
                console.log("Attempting to reconnect WebSocket");
                setupWebSocket();
            //}
        }, 1000);
    });

    socket.addEventListener("message", (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Validate the data structure
            if (!data || !data.channel || !Array.isArray(data.channel.alternatives) || !data.channel.alternatives[0]) {
                console.log("Received incomplete transcription data:", data);
                return;
            }

            const transcript = data.channel.alternatives[0].transcript;
            if (transcript && transcript.trim() !== "") {
                finalTranscript += transcript + ' ';
                processTranscriptWithLLM(finalTranscript);
                updateStatus(`Listening... (Heard: ${finalTranscript})`, "listening");
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
            console.log("Raw message data:", event.data);
            updateStatus("Error processing audio. Please try again.", "error");
        }
    });
}

// 7. EVENT LISTENERS
recordBtn.addEventListener('click', async () => {
    console.log('Record button clicked');
    
    try {
        if (!isRecording) {
            console.log('Starting new recording');
            // Setup new WebSocket connection
            setupWebSocket();
            // Wait for WebSocket to be ready
            await new Promise((resolve, reject) => {
                const checkSocket = () => {
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        resolve();
                    } else if (!socket || socket.readyState === WebSocket.CLOSED) {
                        reject(new Error("Failed to establish WebSocket connection"));
                    } else {
                        setTimeout(checkSocket, 100);
                    }
                };
                checkSocket();
            });
            
            microphone = await getMicrophone();
            await openMicrophone(microphone, socket);
        } else {
            console.log('Stopping recording');
            await closeMicrophone(microphone);
            microphone = null;
        }
    } catch (error) {
        console.error("Error handling microphone:", error);
        updateStatus("Error accessing microphone. Please check permissions.", "error");
        // Reset state on error
        isRecording = false;
        microphone = null;
        mediaStream = null;
        await closeWebSocket();
        document.body.classList.remove("recording");
        recordBtn.classList.remove('recording');
        recordBtn.querySelector('i').className = 'fas fa-microphone';
    }
});

saveBtn.addEventListener('click', handleSave);
cancelBtn.addEventListener('click', handleCancel);

// 8. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    renderSections();
    // Disable start button until connection is ready
    recordBtn.disabled = true;
    initializeLLM();
    setupWebSocket();
});