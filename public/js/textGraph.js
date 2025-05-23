//import nodeHtmlToImage from 'node-html-to-image';
import { getChartData } from './chartDataGrabber.js';
/**
 * Generates an HTML string suitable for node-html-to-image, displaying
 * motherboard updates, new boards, and user activity based on input data,
 * using standard fonts, a background image, and a logo.
 *
 * @param {object} data The input data object. Expected structure:
 * {
 * userMobos?: { [boardName: string]: { signups?: number } },
 * weeklyUpdates?: {
 * [boardName: string]: { heldversion?: string, notified?: number },
 * newBoards?: { [boardName: string]: any }
 * }
 * }
 * @returns {string} The generated HTML string.
 */
function generateHtml(data) {
    // --- Configuration ---
    const width = 1036;
    const height = 740;
    const bgColor = '#efe7db'; // Fallback background color
    const textColor = '#000000';
    const fontFamily = 'Arial, sans-serif';
    const backgroundImageUrl = 'https://www.asrockbioschecker.link/images/tilestone2.jpg';
    const logoImageUrl = 'https://www.asrockbioschecker.link/images/watermark.png';
    const logoWidth = '120px'; // Adjust desired logo width

    // --- Data Processing ---
    let updateList = [];
    let newBoardList = [];
    let totalNotified = 0;
    let totalSignups = 0;
    let outputTextLines = [];

    const weeklyUpdates = data?.weeklyUpdates;
    if (weeklyUpdates) {
        for (const [key, value] of Object.entries(weeklyUpdates)) {
            if (key === 'newBoards') continue;
            if (typeof value === 'object' && value !== null && value.hasOwnProperty('heldversion')) {
                updateList.push(`&nbsp;&nbsp;-&nbsp;${escapeHtml(key)} ${escapeHtml(value.heldversion)}`);
                totalNotified += Number(value.notified) || 0;
            }
        }
    }

    const newBoards = weeklyUpdates?.newBoards;
    if (typeof newBoards === 'object' && newBoards !== null) {
        for (const key of Object.keys(newBoards)) {
            newBoardList.push(`&nbsp;&nbsp;-&nbsp;${escapeHtml(key)}`);
        }
    }

    const userMobos = data?.userMobos;
    if (userMobos) {
        for (const moboData of Object.values(userMobos)) {
            if (typeof moboData === 'object' && moboData !== null && moboData.hasOwnProperty('signups')) {
                totalSignups += Number(moboData.signups) || 0;
            }
        }
    }

    // --- Assemble Output Text Lines ---
    let addedSection = false;
    if (updateList.length > 0) {
        outputTextLines.push(`Updates this week: ${updateList.length}`);
        outputTextLines.push(...updateList);
        addedSection = true;
    }
    if (newBoardList.length > 0) {
        if (addedSection) outputTextLines.push('');
        outputTextLines.push('New boards this week:');
        outputTextLines.push(...newBoardList);
        addedSection = true;
    }
    if (addedSection) outputTextLines.push('');
    outputTextLines.push('User activity this week:');
    outputTextLines.push(`Users notified: ${totalNotified}`);
    outputTextLines.push(`New signups: ${totalSignups}`);

    const htmlContent = outputTextLines.join('<br>\n');

    // --- Construct Final HTML String ---
    const htmlString = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            /* --- Dimensions & Base Styling --- */
            width: ${width}px;
            height: ${height}px;
            color: ${textColor};
            font-family: ${fontFamily};
            font-size: 16px;
            line-height: 1.5;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;

            /* --- Background Image --- */
            background-color: ${bgColor};
            background-image: url('${backgroundImageUrl}');
            background-size: cover;
            background-position: center center;
            background-repeat: no-repeat;

            /* --- Centering for the text block --- */
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .content {
            text-align: left;
            white-space: normal;
            font-weight: normal; /* Or 'bold' if you want the text bolder like the example image title */
             /* Optional: Add a semi-transparent background to text for readability over complex backgrounds */
             /* background-color: rgba(255, 255, 255, 0.8); */
             /* padding: 15px; */
             /* border-radius: 5px; */
             /* max-width: 90%; */
        }

        /* --- Logo Styling --- */
        .logo {
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: ${logoWidth};
            height: auto;
            z-index: 10;
        }
    </style>
</head>
<body>
    <div class="content">
        ${htmlContent}
    </div>

    <img src="${logoImageUrl}" class="logo" alt="Logo">

</body>
</html>`;

    return htmlString;
}

// --- Helper function to escape HTML characters (unchanged) ---
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }


// --- Example Usage ---

// Example Data (using the full data example)
const exampleData = {
    "snapshotDate": "2025/04/16", // Updated date
    "userMobos": {
        "X870E Taichi Lite": { "socket": "AM5", "maker": "AMD", "count": 1, "signups": 0 },
        "Z790 PG Lightning": { "socket": "1700", "maker": "Intel", "count": 3, "signups": 1 },
        "B650 Aorus Pro": { "socket": "AM5", "maker": "AMD", "count": 5, "signups": 2 }
    },
    "weeklyUpdates": {
        "X870E Taichi Lite": { "helddate": "2025/04/15", "heldversion": "1.0.0", "notified": 1 },
        "Z790 PG Lightning": { "helddate": "2025/04/14", "heldversion": "F10a", "notified": 3 },
        "newBoards": {
            "X990 <New> Mobo": { "socket": "AM5", "maker": "AMD", "release": "2024/12/3" },
            "Z890 & Dark Hero": { "socket": "18XX", "maker": "Intel", "release": "2025/01/15" }
        }
    }
};

const data = await getChartData();
// const data = exampleData; // Use example data for testing

// Generate HTML String
const htmlString = generateHtml(data);


function generateImage(data) {
	const image = nodeHtmlToImage({
		html: data,
		puppeteerArgs: {
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		}
	});
	return image;
}
export async function generateImageFromData() {
    return await generateImage(htmlString);
}

// await generateImageFromData();
console.log(htmlString);

// Example HTML Output

// <!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//     <style>
//         body {
//             /* --- Dimensions & Base Styling --- */
//             width: 1036px;
//             height: 740px;
//             color: #000000;
//             font-family: Arial, sans-serif;
//             font-size: 16px;
//             line-height: 1.5;
//             margin: 0;
//             padding: 20px;
//             box-sizing: border-box;
//             position: relative;
//             overflow: hidden;

//             /* --- Background Image --- */
//             background-color: #efe7db;
//             background-image: url('https://www.asrockbioschecker.link/images/tilestone2.jpg');
//             background-size: cover;
//             background-position: center center;
//             background-repeat: no-repeat;

//             /* --- Centering for the text block --- */
//             display: flex;
//             justify-content: center;
//             align-items: center;
//         }

//         .content {
//             text-align: left;
//             white-space: normal;
//             font-weight: normal; /* Or 'bold' if you want the text bolder like the example image title */
//              /* Optional: Add a semi-transparent background to text for readability over complex backgrounds */
//              /* background-color: rgba(255, 255, 255, 0.8); */
//              /* padding: 15px; */
//              /* border-radius: 5px; */
//              /* max-width: 90%; */
//         }

//         /* --- Logo Styling --- */
//         .logo {
//             position: absolute;
//             bottom: 20px;
//             right: 20px;
//             width: 120px;
//             height: auto;
//             z-index: 10;
//         }
//     </style>
// </head>
// <body>
//     <div class="content">
//         Updates this week: 36<br>
// &nbsp;&nbsp;-&nbsp;X570 Creator 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Phantom Gaming 4 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Taichi Razer Edition 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Taichi 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Extreme4 WiFi ax 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Extreme4 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Steel Legend 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 AQUA 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Phantom Gaming-ITX/TB3 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550 Taichi Razer Edition 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M Pro RS 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M Pro SE 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550 Extreme4 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550 Steel Legend 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550 Pro4 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M Steel Legend 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M/ac 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M WiFi SE 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Phantom Gaming 4S 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M Phantom Gaming 4 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M WiFi 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M-ITX/ac 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M-HVS SE 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;A520M Pro4 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;A520M-HVS 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;A520M-HDV 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B550M Pro4 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;A520M/ac 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;A520M-ITX/ac 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X470 Taichi Ultimate 10.41[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X470 Taichi 10.41[Beta]<br>
// &nbsp;&nbsp;-&nbsp;B860I Lightning WiFi 1.14<br>
// &nbsp;&nbsp;-&nbsp;B550 Taichi 3.61[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Phantom Gaming X 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Steel Legend WiFi ax 5.65[Beta]<br>
// &nbsp;&nbsp;-&nbsp;X570 Phantom Gaming 4 WiFi ax 5.65[Beta]<br>
// <br>
// User activity this week:<br>
// Users notified: 2<br>
// New signups: 0
//     </div>

//     <img src="https://www.asrockbioschecker.link/images/watermark.png" class="logo" alt="Logo">

// </body>
// </html>