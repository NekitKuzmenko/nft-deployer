function sleep(duration) {

    return new Promise(resolve => setTimeout(resolve, duration));

}

function bufferToChunks(buff, chunkSize) {

    const chunks = [];

    while (buff.byteLength > 0) {

        chunks.push(buff.slice(0, chunkSize));

        buff = buff.slice(chunkSize);

    }

    return chunks;

}

function makeSnakeCell(data) {

    const chunks = bufferToChunks(data, 127);
  
    if (chunks.length === 0) return ton_core.beginCell().endCell();
  
    if (chunks.length === 1) return ton_core.beginCell().storeBuffer(chunks[0]).endCell();
  
    let curCell = ton_core.beginCell();
  
    for (let i = chunks.length - 1; i >= 0; i--) {

        const chunk = chunks[i];
  
        curCell.storeBuffer(chunk);
  
        if (i - 1 >= 0) {

            const nextCell = ton_core.beginCell();

            nextCell.storeRef(curCell);

            curCell = nextCell;

        }

    }
  
    return curCell.endCell();

}


function encodeOffChainContent(content) {

    let data = Buffer.from(content);

    data = Buffer.concat([Buffer.from([0x01]), data]);

    return makeSnakeCell(data);

}

module.exports = { sleep, bufferToChunks, makeSnakeCell, encodeOffChainContent };