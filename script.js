// Global variables
let flowStepCount = 0;
let chart = null;
let performanceCoeffsPsig = null; // Store coefficients for psig
let performanceCoeffsBarg = null; // Store coefficients for barg

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Add initial flow steps (4 by default based on the example)
    for (let i = 0; i < 4; i++) {
        addFlowStep();
    }

    // Set default date to current date/time
    const now = new Date();
    const dateTimeInput = document.getElementById('testDate');
    dateTimeInput.value = now.toISOString().slice(0, 16);
});

/**
 * Add a new flow step to the form
 */
function addFlowStep() {
    flowStepCount++;
    const container = document.getElementById('flowStepsContainer');

    const stepDiv = document.createElement('div');
    stepDiv.className = 'flow-step';
    stepDiv.id = `flowStep${flowStepCount}`;

    stepDiv.innerHTML = `
        <div class="flow-step-header">
            <span class="flow-step-title">Step ${flowStepCount}</span>
            <button type="button" class="remove-step" onclick="removeFlowStep(${flowStepCount})" title="Remove">×</button>
        </div>
        <div class="flow-step-grid">
            <div class="input-group">
                <label>Flow Rate</label>
                <input type="number" step="0.0001" placeholder="15.01" class="flow-rate" id="flowRate${flowStepCount}">
            </div>
            <div class="input-group">
                <label>Duration</label>
                <input type="number" step="0.01" placeholder="8" class="duration" id="duration${flowStepCount}">
            </div>
            <div class="input-group">
                <label>WH Pressure</label>
                <input type="number" step="0.01" placeholder="590" class="wh-pressure" id="whPressure${flowStepCount}">
            </div>
            <div class="input-group">
                <label>WH Temp</label>
                <input type="number" step="0.01" placeholder="43.15" class="wh-temp" id="whTemp${flowStepCount}">
            </div>
            <div class="input-group">
                <label>BH Pressure</label>
                <input type="number" step="0.01" placeholder="680.89" class="bh-pressure" id="bhPressure${flowStepCount}">
            </div>
            <div class="input-group">
                <label>Choke</label>
                <input type="number" step="0.01" placeholder="413.06" class="choke-pressure" id="chokePressure${flowStepCount}">
            </div>
        </div>
    `;

    container.appendChild(stepDiv);
}

/**
 * Remove a flow step
 */
function removeFlowStep(stepId) {
    const step = document.getElementById(`flowStep${stepId}`);
    if (step) {
        step.remove();
    }
}

/**
 * Clear all flow steps
 */
function clearFlowSteps() {
    const container = document.getElementById('flowStepsContainer');
    container.innerHTML = '';
    flowStepCount = 0;
}

/**
 * Collect all flow step data
 */
function collectFlowStepData() {
    const flowSteps = document.querySelectorAll('.flow-step');
    const data = [];

    flowSteps.forEach((step, index) => {
        const flowRate = parseFloat(step.querySelector('.flow-rate').value);
        const duration = parseFloat(step.querySelector('.duration').value);
        const whPressure = parseFloat(step.querySelector('.wh-pressure').value);
        const whTemp = parseFloat(step.querySelector('.wh-temp').value);
        const bhPressure = parseFloat(step.querySelector('.bh-pressure').value);
        const chokePressure = parseFloat(step.querySelector('.choke-pressure').value) || 0;

        if (!isNaN(flowRate) && !isNaN(whPressure)) {
            data.push({
                step: index + 1,
                flowRate: flowRate,
                duration: duration || 0,
                whPressure: whPressure,
                whTemp: whTemp || 0,
                bhPressure: bhPressure || 0,
                chokePressure: chokePressure,
                whPressureBarg: psigToBarg(whPressure)
            });
        }
    });

    return data;
}

/**
 * Convert psig to barg
 */
function psigToBarg(psig) {
    // 1 psig ≈ 0.0689476 barg
    return psig * 0.0689476;
}

/**
 * Perform quadratic regression to find coefficients a, b, c
 * for the equation: P = a*Q² + b*Q + c
 * where P = pressure and Q = flow rate
 * @param {Array} data - Flow step data
 * @param {string} pressureUnit - 'psig' or 'barg'
 */
function calculateQuadraticRegression(data, pressureUnit = 'psig') {
    const n = data.length;

    if (n < 3) {
        alert('At least 3 flow steps are required for quadratic regression');
        return null;
    }

    // Calculate sums
    let sumQ = 0, sumQ2 = 0, sumQ3 = 0, sumQ4 = 0;
    let sumP = 0, sumPQ = 0, sumPQ2 = 0;

    data.forEach(point => {
        const Q = point.flowRate;
        // Use the appropriate pressure unit
        const P = pressureUnit === 'barg' ? point.whPressureBarg : point.whPressure;

        sumQ += Q;
        sumQ2 += Q * Q;
        sumQ3 += Q * Q * Q;
        sumQ4 += Q * Q * Q * Q;
        sumP += P;
        sumPQ += P * Q;
        sumPQ2 += P * Q * Q;
    });

    // Solve the system of equations using Cramer's rule
    // | n      sumQ    sumQ2  |   | c |   | sumP   |
    // | sumQ   sumQ2   sumQ3  | × | b | = | sumPQ  |
    // | sumQ2  sumQ3   sumQ4  |   | a |   | sumPQ2 |

    const matrix = [
        [n, sumQ, sumQ2],
        [sumQ, sumQ2, sumQ3],
        [sumQ2, sumQ3, sumQ4]
    ];

    const constants = [sumP, sumPQ, sumPQ2];

    const det = calculateDeterminant(matrix);

    if (Math.abs(det) < 1e-10) {
        alert('Cannot calculate coefficients: singular matrix');
        return null;
    }

    // Calculate each coefficient using Cramer's rule
    const c = calculateDeterminant(replaceColumn(matrix, constants, 0)) / det;
    const b = calculateDeterminant(replaceColumn(matrix, constants, 1)) / det;
    const a = calculateDeterminant(replaceColumn(matrix, constants, 2)) / det;

    return { a, b, c };
}

/**
 * Calculate the determinant of a 3x3 matrix
 */
function calculateDeterminant(matrix) {
    const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/**
 * Replace a column in a matrix
 */
function replaceColumn(matrix, newColumn, colIndex) {
    return matrix.map((row, i) => {
        const newRow = [...row];
        newRow[colIndex] = newColumn[i];
        return newRow;
    });
}

/**
 * Calculate R-squared value
 * @param {Array} data - Flow step data
 * @param {Object} coeffs - Coefficients (a, b, c)
 * @param {string} pressureUnit - 'psig' or 'barg'
 */
function calculateRSquared(data, coeffs, pressureUnit = 'psig') {
    const { a, b, c } = coeffs;

    // Get pressure values based on unit
    const pressureKey = pressureUnit === 'barg' ? 'whPressureBarg' : 'whPressure';

    // Calculate mean of observed values
    const meanP = data.reduce((sum, point) => sum + point[pressureKey], 0) / data.length;

    // Calculate sum of squares
    let ssTot = 0;
    let ssRes = 0;

    data.forEach(point => {
        const predicted = a * point.flowRate * point.flowRate + b * point.flowRate + c;
        ssTot += Math.pow(point[pressureKey] - meanP, 2);
        ssRes += Math.pow(point[pressureKey] - predicted, 2);
    });

    return 1 - (ssRes / ssTot);
}

/**
 * Populate the results table
 */
function populateResultsTable(data) {
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';

    data.forEach(point => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${point.step}</td>
            <td>${point.flowRate.toFixed(4)}</td>
            <td>${point.whPressure.toFixed(2)}</td>
            <td>${point.bhPressure.toFixed(2)}</td>
            <td>${point.chokePressure.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Display coefficients
 * @param {Object} coeffsPsig - PSIG coefficients
 * @param {Object} coeffsBarg - BARG coefficients
 */
function displayCoefficients(coeffsPsig, coeffsBarg) {
    // Display PSIG coefficients (primary)
    document.getElementById('coeffA').textContent = coeffsPsig.a.toFixed(6);
    document.getElementById('coeffB').textContent = coeffsPsig.b.toFixed(6);
    document.getElementById('coeffC').textContent = coeffsPsig.c.toFixed(6);

    // Log both for reference
    console.log('PSIG Coefficients:', coeffsPsig);
    console.log('BARG Coefficients:', coeffsBarg);
}

/**
 * Draw the performance curve chart
 */
function drawChart(data, coeffs) {
    const canvas = document.getElementById('performanceChart');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = canvas.parentElement.offsetWidth - 32;
    canvas.height = canvas.parentElement.offsetHeight - 32;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 50;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find data ranges
    const maxFlowRate = Math.max(...data.map(d => d.flowRate)) * 1.15;
    const pressures = data.map(d => d.whPressure);
    const minPressure = Math.min(...pressures) * 0.95;
    const maxPressure = Math.max(...pressures) * 1.05;

    // Scaling functions
    const scaleX = (flowRate) => padding + (flowRate / maxFlowRate) * (width - 2 * padding);
    const scaleY = (pressure) => height - padding - ((pressure - minPressure) / (maxPressure - minPressure)) * (height - 2 * padding);

    // Draw subtle grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
        const x = padding + (i / 5) * (width - 2 * padding);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();

        const y = padding + (i / 5) * (height - 2 * padding);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#737373';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels
    for (let i = 0; i <= 5; i++) {
        const flowRate = (i / 5) * maxFlowRate;
        const x = scaleX(flowRate);
        ctx.fillText(flowRate.toFixed(1), x, height - padding + 20);
    }

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const pressure = minPressure + (i / 5) * (maxPressure - minPressure);
        const y = scaleY(pressure);
        ctx.fillText(pressure.toFixed(0), padding - 10, y + 5);
    }

    // Draw the regression curve
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const { a, b, c } = coeffs;
    for (let flowRate = 0; flowRate <= maxFlowRate; flowRate += maxFlowRate / 150) {
        const pressure = a * flowRate * flowRate + b * flowRate + c;
        const x = scaleX(flowRate);
        const y = scaleY(pressure);

        if (flowRate === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // Draw data points
    data.forEach(point => {
        const x = scaleX(point.flowRate);
        const y = scaleY(point.whPressure);

        // Outer circle (white)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, 2 * Math.PI);
        ctx.fill();

        // Inner circle (accent)
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
    });
}

/**
 * Main calculate function
 */
function calculate() {
    // Collect flow step data
    const data = collectFlowStepData();

    if (data.length < 2) {
        alert('Please enter at least 2 flow steps with valid data');
        return;
    }

    // Calculate coefficients for psig using quadratic regression
    const coeffsPsig = calculateQuadraticRegression(data, 'psig');

    if (!coeffsPsig) {
        return;
    }

    // Calculate coefficients for barg using quadratic regression
    const coeffsBarg = calculateQuadraticRegression(data, 'barg');

    if (!coeffsBarg) {
        return;
    }

    // Store coefficients globally for calculator
    performanceCoeffsPsig = coeffsPsig;
    performanceCoeffsBarg = coeffsBarg;

    // Calculate R-squared for psig
    const rSquared = calculateRSquared(data, coeffsPsig, 'psig');

    // Display results (show psig coefficients as primary)
    displayCoefficients(coeffsPsig, coeffsBarg);
    populateResultsTable(data);

    // Show results section
    document.getElementById('resultsSection').style.display = 'block';

    // Draw chart (using psig data)
    drawChart(data, coeffsPsig);

    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });

    console.log('Calculation complete:');
    console.log('PSIG Coefficients:', coeffsPsig);
    console.log('BARG Coefficients:', coeffsBarg);
    console.log('R²:', rSquared.toFixed(4));
}

/**
 * Calculate pressure from flow rate using performance curve coefficients
 */
function calculatePressure() {
    // Check if coefficients are available
    if (!performanceCoeffsPsig || !performanceCoeffsBarg) {
        alert('Please calculate the performance curve first by entering flow test data and clicking Calculate.');
        return;
    }

    // Get input values
    const flowRateInput = document.getElementById('calcFlowRate');
    const flowUnitSelect = document.getElementById('calcFlowUnit');
    const flowRate = parseFloat(flowRateInput.value);
    const flowUnit = flowUnitSelect.value;

    // Validate input
    if (isNaN(flowRate) || flowRate < 0) {
        alert('Please enter a valid flow rate (positive number)');
        return;
    }

    // Convert to MMSCFD if in MMSCFH
    let flowRateMMSCFD = flowRate;
    if (flowUnit === 'MMSCFH') {
        flowRateMMSCFD = flowRate / 24; // Convert hourly to daily
    }

    // Calculate pressure using SEPARATE coefficient sets for each unit
    // This matches the Excel approach for better accuracy
    const { a: a_psig, b: b_psig, c: c_psig } = performanceCoeffsPsig;
    const { a: a_barg, b: b_barg, c: c_barg } = performanceCoeffsBarg;

    const pressurePsig = a_psig * flowRateMMSCFD * flowRateMMSCFD + b_psig * flowRateMMSCFD + c_psig;
    const pressureBarg = a_barg * flowRateMMSCFD * flowRateMMSCFD + b_barg * flowRateMMSCFD + c_barg;

    // Display results
    document.getElementById('resultPsig').textContent = pressurePsig.toFixed(2);
    document.getElementById('resultBarg').textContent = pressureBarg.toFixed(2);
    document.getElementById('calcResult').style.display = 'grid';

    console.log(`Pressure calculation: ${flowRateMMSCFD.toFixed(4)} MMSCFD → ${pressurePsig.toFixed(2)} psig (${pressureBarg.toFixed(2)} barg)`);
}
