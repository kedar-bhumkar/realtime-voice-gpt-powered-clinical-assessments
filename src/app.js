import { OpenAI } from  "https://esm.sh/openai";

const tools = [{
    "type": "function",
    "name": "get_weather",
    "description": "Get current temperature for a given location.",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City and country e.g. Bogotá, Colombia"
            }
        },
        "required": [
            "location"
        ],
        "additionalProperties": false
    }
},{
    "type": "function",
    "name": "handleSave",
    "description": "Handle the save action. Call this function when the users asks to save the assessment",
    "parameters": {
    }
},{
    "type": "function",
    "name": "handleCancel",
    "description": "Handle the cancel action. Call this function when the users asks to cancel the assessment",
    "parameters": {
    }
}
];




// 1. DATA AND CONSTANTS
const QUESTIONS = {
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
            "instruction": "Primary Care Provider (PCP) populates from Physician Information. If PCP did not populate, please update Pathway with PCP. Select No for this question and enter PCP information in the assessment."
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
};

// Get API key from environment variable
const OPENAI_API_KEY = ""

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
let showAllQuestions = false;
let answersState = {};

// 4. UI FUNCTIONS
function renderQuestions() {
    let html = '';
    const questionsToShow = showAllQuestions ? QUESTIONS.questions : [QUESTIONS.questions[0]];
    questionsToShow.forEach(q => {
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

    // Always add event listener for the first question's radio buttons
    const radios = document.querySelectorAll('input[name="q1"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            answersState['q1'] = e.target.value;
            if (e.target.value === '1') { // 'Yes' selected
                showAllQuestions = true;
                renderQuestions();
            } else if (e.target.value === '2') { // 'No' selected
                showAllQuestions = false;
                // Clear all answers except q1
                Object.keys(answersState).forEach(key => { if (key !== 'q1') delete answersState[key]; });
                renderQuestions();
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
    let triggeredShowAll = false;
    for (const questionId in answers) {
        const answerId = answers[questionId];
        answersState[questionId] = answerId;
        // If q1 is set to 'No' programmatically, hide all questions except q1 and clear other answers
        if (questionId === 'q1' && answerId === '2' && showAllQuestions) {
            showAllQuestions = false;
            Object.keys(answersState).forEach(key => { if (key !== 'q1') delete answersState[key]; });
            renderQuestions();
            return; // No need to re-apply other answers
        }
        // Find the question type
        const question = QUESTIONS.questions.find(q => q.id === questionId);
        if (Array.isArray(answerId) && question && question.type === 'checkbox') {
            answerId.forEach(val => {
                const checkbox = document.querySelector(`input[type=\"checkbox\"][name=\"${questionId}\"][value=\"${val}\"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    const block = document.getElementById(`block-${questionId}`);
                    if (block) {
                        block.style.backgroundColor = '#e8f5e9';
                        setTimeout(() => { block.style.backgroundColor = 'transparent'; }, 2000);
                    }
                }
            });
        } else {
            const radioButton = document.querySelector(`input[name=\"${questionId}\"][value=\"${answerId}\"]`);
            if (radioButton) {
                radioButton.checked = true;
                // Add a visual cue
                const block = document.getElementById(`block-${questionId}`);
                if (block) {
                    block.style.backgroundColor = '#e8f5e9';
                    setTimeout(() => { block.style.backgroundColor = 'transparent'; }, 2000);
                }
            }
        }
        // If q1 is set to 'Yes' programmatically, trigger showing all questions
        if (questionId === 'q1' && answerId === '1' && !showAllQuestions) {
            showAllQuestions = true;
            triggeredShowAll = true;
        }
    }
    if (triggeredShowAll) {
        renderQuestions();
        // Optionally, re-apply answers to the rest of the questions
        for (const questionId in answers) {
            if (questionId !== 'q1') {
                const answerId = answers[questionId];
                const question = QUESTIONS.questions.find(q => q.id === questionId);
                if (Array.isArray(answerId) && question && question.type === 'checkbox') {
                    answerId.forEach(val => {
                        const checkbox = document.querySelector(`input[type=\"checkbox\"][name=\"${questionId}\"][value=\"${val}\"]`);
                        if (checkbox) {
                            checkbox.checked = true;
                            const block = document.getElementById(`block-${questionId}`);
                            if (block) {
                                block.style.backgroundColor = '#e8f5e9';
                                setTimeout(() => { block.style.backgroundColor = 'transparent'; }, 2000);
                            }
                        }
                    });
                } else {
                    const radioButton = document.querySelector(`input[name=\"${questionId}\"][value=\"${answerId}\"]`);
                    if (radioButton) {
                        radioButton.checked = true;
                        const block = document.getElementById(`block-${questionId}`);
                        if (block) {
                            block.style.backgroundColor = '#e8f5e9';
                            setTimeout(() => { block.style.backgroundColor = 'transparent'; }, 2000);
                        }
                    }
                }
            }
        }
    }
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
      You are an expert AI assistant for a clinical setting. Your task is to analyze a nurse's dictated transcript and fill out an assessment form based on the provided assessment questions and nurse transcript.
      **ASSESSMENT QUESTIONS:**
      ${JSON.stringify(QUESTIONS, null, 2)}

      **NURSE'S TRANSCRIPT:**
      "${transcript}"

      
      **INSTRUCTIONS:**
      1. Read the provided transcript carefully.Determine if you need to call a tool or you need to return json of questions and answers. If you are calling a tool, do not execute next steps. 
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
                    "q3": "2",
                    }
                    Since there is no mention of other questions , those questions are ommited from the output JSON.



    `;
}

async function processTranscriptWithLLM(transcript) {
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

// 6. WEB SPEECH API SETUP
function setupSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        updateStatus("Speech recognition not supported in this browser.", "error");
        recordBtn.disabled = true;
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isRecording = true;
        recordBtn.classList.add('recording');
        recordBtn.querySelector('i').className = 'fas fa-stop-circle';
        updateStatus("Listening... Speak now.", "listening");
        finalTranscript = '';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            // Check if the current speech result is final (complete and stable)
            // isFinal is a boolean property set by the Web Speech API when it's confident
            // the transcription is complete and won't change further
            if (event.results[i].isFinal) {
                const finalChunk = event.results[i][0].transcript.trim();
                finalTranscript += finalChunk + '. ';
                // Once a sentence is finished, process it.
                if (finalChunk.length > 3) { // Avoid processing tiny fragments
                    processTranscriptWithLLM(finalTranscript);
                }
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        // Show interim results for real-time feedback
        statusDiv.textContent = `Listening... (Heard: ${finalTranscript}${interimTranscript})`;
    };
    
    recognition.onend = () => {
        isRecording = false;
        recordBtn.classList.remove('recording');
        recordBtn.querySelector('i').className = 'fas fa-microphone';
        updateStatus("Recording stopped.", "idle");
    };

    recognition.onerror = (event) => {
        updateStatus(`Speech recognition error: ${event.error}`, "error");
    };
}

// 7. EVENT LISTENERS
recordBtn.addEventListener('click', () => {
    if (!recognition) return;
    
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

saveBtn.addEventListener('click', handleSave);
cancelBtn.addEventListener('click', handleCancel);

// 8. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    renderQuestions();
    setupSpeechRecognition();
    // Disable start button until model is loaded
    recordBtn.disabled = true;
    initializeLLM();
});