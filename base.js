async function hashToHex(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function expandKeyBits(password, totalBitsNeeded) {
  let bits = [];
  let counter = 0;

  while (bits.length < totalBitsNeeded) {
    const toHash = password + counter.toString();
    const partBits = await PassToBits(toHash);
    bits = bits.concat(partBits);
    counter++;
  }

  return bits.slice(0, totalBitsNeeded);
}

async function PassToBits(password) {
    const encoder = new TextEncoder();          // Converts string to byte array
    const data = encoder.encode(password);      // UTF-8 encode password

    const hashBuffer = await crypto.subtle.digest('SHA-256', data); // 256-bit hash
    const hashArray = Array.from(new Uint8Array(hashBuffer));       // Turn buffer into array of bytes

    // Convert bytes into bits
    const bits = [];
    for (let byte of hashArray) {
        for (let i = 7; i >= 0; i--) {
            bits.push((byte >> i) & 1);         // Extract bits one by one
        }
    }

    return bits; // You now have 256 bits like [1,0,1,1,0,...]
}


function initializeGrid(gridSize, keyBits) {
    const cells = [];
    let idx = 0;

    for (let i = 0; i < gridSize; i++) {
        cells[i] = [];
        for (let j = 0; j < gridSize; j++) {
            const bit = keyBits[idx % keyBits.length];  // Reuse bits if needed
            const age = bit === 1 ? 100 : 0;            // Set age based on state
            cells[i][j] = [bit, age];
            idx++;
        }
    }

    return cells;
}


function evoStep(cells){
        const total = cells.length;
        const len =cells[0].length;
        const outputBits=[];


        //determining current cell values and next cells
        let nextCells=[];
        for(let i=0;i<len;i++){
            nextCells[i]=[];
            for(let j=0;j<len;j++){
                //getting values for state
                let upLeft = cells[(i - 1 + total) % total][(j - 1 + total) % total][0];
                let upMid = cells[i][(j - 1 + total) % total][0];
                let upRight = cells[(i + 1) % total][(j - 1 + total) % total][0];
                let left = cells[(i - 1 + total) % total][j][0];
                let current = cells[i][j][0];
                let right = cells[(i + 1) % total][j][0];
                let botLeft = cells[(i - 1 + total) % total][(j + 1) % total][0];
                let botMid = cells[i][(j + 1) % total][0];
                let botRight = cells[(i + 1) % total][(j + 1) % total][0];


                //getting values for age
                let age = cells[i][j][1];
                let upLeftAge = cells[(i - 1 + total) % total][(j - 1 + total) % total][1];
                let upMidAge = cells[i][(j - 1 + total) % total][1];
                let upRightAge = cells[(i + 1) % total][(j - 1 + total) % total][1];
                let leftAge = cells[(i - 1 + total) % total][j][1];
                let rightAge = cells[(i + 1) % total][j][1];
                let botLeftAge = cells[(i - 1 + total) % total][(j + 1) % total][1];
                let botMidAge = cells[i][(j + 1) % total][1];
                let botRightAge = cells[(i + 1) % total][(j + 1) % total][1];


                //funciton to change state
                let [nextState,nextAge]=changeState(upLeft,upMid,upRight,left,current,right,botLeft,botMid,botRight,age,upLeftAge,upMidAge,upRightAge,leftAge,rightAge,botLeftAge,botMidAge,botRightAge);
                nextCells[i][j] = [nextState,nextAge];
                outputBits.push(nextState);

            }
        }
        return [nextCells,outputBits];

}


function changeState(upLeft,upMid,upRight,left,current,right,botLeft,botMid,botRight,age,upLeftAge,upMidAge,upRightAge,leftAge,rightAge,botLeftAge,botMidAge,botRightAge){
    let newAge=age-1;
    let neighborval=upLeft+upMid+upRight+left+right+botLeft+botMid+botRight;
    let neighborsAges=[upLeftAge,upMidAge,upRightAge,leftAge,rightAge,botLeftAge,botMidAge,botRightAge];
    let neighborAgeGreater=0;
    for(let i=0;i<8;i++){
        if(neighborsAges[i]>=50){
            neighborAgeGreater++;
        }
    }

    //if currently dead
    if(current==0){
        //if exactly 3 next will be alive and are of reproductive age, reproduce
        if((neighborval)==3&&neighborAgeGreater>=2){
            newAge=100;
            return [1,100];
        }
        else{
            return [0,0]
        }
    }

    //if more than 3 neighbors harm by overcrowding
    else if((neighborval)>3){
        //stress from overcrowding (removed for now)
        newAge=newAge-0*(neighborval-3);
        //if alive still
        if (newAge>0){
            return [1,newAge];
        }
        //if not
        else{
            return [0,0];
        }
    }

    //if already alive and 3 survives if age is not death age
    else if((neighborval)==3 && current==1&& newAge>0){
        return [1,newAge];
    }
    //if already alive and 2 survives if age is not death age
    else if((neighborval)==2 && current==1 &&newAge>0){
        return [1,newAge];
    }


    //1 neighbor
    else if(neighborval==1&&current==1){
        newAge-=50;
        if (newAge<1){
            return [0,0];
        }
        else{
            return [1,newAge];
        }
    }

    //0 neighbor
    else if(neighborval==0&&current==1){
        newAge-=99;
        if (newAge<1){
            return [0,0];
        }
        else{
            return [1,newAge];
        }
    }

    else return [0,0]
    
}

async function generateKeystream(password, gridSize, steps, byteLength) {
    const totalBitsNeeded = gridSize * gridSize;
    const bits = await expandKeyBits(password, totalBitsNeeded);
    let cells = initializeGrid(gridSize, bits);

    let allBits = [];

    for (let i = 0; i < steps; i++) {
        const [nextCells, outputBits] = evoStep(cells);
        cells = nextCells;
        allBits.push(...outputBits);
    }

    // Convert bits into bytes
    const keystream = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
            const bit = allBits[i * 8 + b] || 0;
            byte |= (bit << (7 - b));
        }
        keystream[i] = byte;
    }

    return keystream;
}





async function encrypt() {
    const gridSize = parseInt(document.getElementById("gridSize").value);
    const steps = parseInt(document.getElementById("steps").value);
    const file = document.getElementById('fileInput').files[0];
    const password = document.getElementById('password').value;

    if (!file || !password) {
        alert("Please select a file and enter a password.");
        return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBytes = new Uint8Array(arrayBuffer);

    const keystream = await generateKeystream(password, gridSize, steps, inputBytes.length);

    const encrypted = new Uint8Array(inputBytes.length);
    for (let i = 0; i < inputBytes.length; i++) {
        encrypted[i] = inputBytes[i] ^ keystream[i];
    }


    downloadFile(encrypted, "encrypted.bin"); 
    let gap = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    let gapb = "&nbsp;&nbsp;";

    //summary for key
    const summary = ` <h1>${gap} Key Summary:${gapb}Password = ${password}  ${gap} Grid Size = ${gridSize}  ${gap} Steps = ${steps}</h1>`;
    
    document.getElementById("keySummary").innerHTML = summary;

}


async function decrypt() {
    const fileType = document.getElementById("fileType").value.trim() || "bin";
    const file = document.getElementById('fileInput').files[0];
    const password = document.getElementById('password').value;
    const gridSize = parseInt(document.getElementById("gridSize").value);
    const steps = parseInt(document.getElementById("steps").value);


    if (!file || !password) {
        alert("Please select a file and enter a password.");
        return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBytes = new Uint8Array(arrayBuffer);

    const keystream = await generateKeystream(password, gridSize, steps, inputBytes.length);

    const decrypted = new Uint8Array(inputBytes.length);
    for (let i = 0; i < inputBytes.length; i++) {
        decrypted[i] = inputBytes[i] ^ keystream[i];
    }

    downloadFile(decrypted, `decrypted.${fileType}`);

}


function downloadFile(byteArray, filename) {
    const blob = new Blob([byteArray]);
    const url = URL.createObjectURL(blob);

    const link = document.getElementById("downloadLink");
    link.href = url;
    link.download = filename;
    link.textContent = "Download " + filename;
    link.style.display = "inline";

    
}



