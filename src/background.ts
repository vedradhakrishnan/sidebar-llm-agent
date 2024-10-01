chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).then(() => {
    console.log("Side panel is now linked to the action icon.");
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Received message:', message);

  if (message.sender === 'user') {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];

      if (currentTab && currentTab.id) {
        // Inject the extraction function into the webpage
        chrome.scripting.executeScript(
          {
            target: { tabId: currentTab.id },
            func: extractInteractiveElements, // The function to execute
          },
          async (injectionResults) => {
            // Handle any errors
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
              return;
            }

            // Get the result from the injected script
            const elements = injectionResults[0].result;
            const elementsJSON = JSON.stringify(elements, null, 2);

            // Call OpenAI API with user message and extracted elements
            const responseText = await fetchOpenAIResponse(
              message.text,
              elementsJSON
            );

            // Send response back to the React app
            chrome.runtime.sendMessage({ sender: 'other', text: responseText });
          }
        );
      }
    });
  }
  sendResponse({ status: 'Message received' });
});

async function fetchOpenAIResponse(
  userMessage: string,
  elementsJSON: string
): Promise<string> {
  const apiKey = 'sk-P3BrAxU5BIGs9u-9Wdzz9pUi1naoS5-H0Xncbj6Lh9T3BlbkFJcZ0ufwAqIai4Kh8my0dhTCbg_myxMV08QmXID8JyoA';  // Replace with your OpenAI API key
  const apiUrl = 'https://api.openai.com/v1/chat/completions';

  const prompt = `
You are a browser automation assistant. Your job is to take a user's request and interpret it in the context of a web page. You are given the following:

1. **User Request**:
\`\`\`
${userMessage}
\`\`\`

2. **Interactive Elements**:
\`\`\`json
${elementsJSON}
\`\`\`

Your goal is to generate JavaScript code that can be injected into the browser's console to complete the user's request by interacting with the relevant elements.

### Instructions:
- First, read and understand the **User Request**.
- Next, analyze the **Interactive Elements** and determine which elements are necessary to fulfill the request.
- Generate a series of JavaScript instructions that automate the task, using the provided element information.

### Output:
**Provide only the JavaScript code** needed to perform the task. **Do not include any explanations, comments, or additional text.**
\`\`\`javascript
`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo', // Or the model you choose
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('OpenAI API error:', data.error);
    return 'Sorry, an error occurred while processing your request.';
  }

  return data.choices[0].message.content.trim();
}

function extractInteractiveElements() {
  function isInputElement(element: Element): element is HTMLInputElement {
    return element.tagName.toLowerCase() === 'input';
  }
  
  // Function to extract relevant attributes from an element
  function extractElementInfo(element: HTMLElement) {
    const info: { [key: string]: any } = {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      class: element.className || null,
      text: element.innerText || element.textContent || null,
    };
  
    if (isInputElement(element)) {
      info.name = element.name || null;
      info.type = element.type || null;
      info.value = element.value || null;
      info.placeholder = element.placeholder || null;
    }
    // Remove null or empty values
    Object.keys(info).forEach((key) => {
      if (info[key] === null || info[key] === '') {
        delete info[key];
      }
    });
    return info;
  }

  // Function to check if an element is visible
  function isElementVisible(element: HTMLElement): boolean {
    return (
      element.offsetParent !== null &&
      getComputedStyle(element).visibility !== 'hidden' &&
      getComputedStyle(element).display !== 'none'
    );
  }

  // Function to check if an element is relevant
  function isElementRelevant(element: HTMLElement): boolean {
    // Exclude elements with certain classes or attributes
    const irrelevantClasses = ['ads', 'hidden', 'promo', 'banner', 'footer'];
    const classList = Array.from(element.classList);

    // Check if the element has any irrelevant classes
    if (classList.some((className) => irrelevantClasses.includes(className))) {
      return false;
    }

    // Exclude elements that are not interactable
    const nonInteractableTags = ['style', 'script', 'link', 'meta', 'noscript'];
    if (nonInteractableTags.includes(element.tagName.toLowerCase())) {
      return false;
    }

    return true;
  }

  // Define selectors for interactive elements
  const interactiveSelectors = [
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'a[href]',
    'label',
    'option',
  ];

  // Select all interactive elements
  const interactiveElements = document.querySelectorAll(
    interactiveSelectors.join(',')
  );

  // Filter elements based on visibility and relevance, and extract their info
  const elementsInfo = Array.from(interactiveElements)
    .filter((element) => isElementVisible(element as HTMLElement))
    .filter((element) => isElementRelevant(element as HTMLElement))
    .map((element) => extractElementInfo(element as HTMLElement));

  // Return the elements info as an array
  return elementsInfo;
}

