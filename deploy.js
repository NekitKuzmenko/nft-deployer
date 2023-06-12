const fs = require('fs');
const ton_core = require('ton-core');
const ton = require('ton');

const { sleep, encodeOffChainContent } = require('./other.js');

async function deployCollection(walletContract, walletSender, owner, royalty, metalink, baselink) {

    let code = ton_core.Cell.fromBoc(fs.readFileSync("nft-collection-editable.boc"))[0];
    let data = ton_core.beginCell()
    .storeAddress(owner)
    .storeUint(0, 64);
    
    let contentCell = ton_core.beginCell();

    let collectionContent = encodeOffChainContent(metalink);

    let commonContent = ton_core.beginCell();
    commonContent.storeBuffer(Buffer.from(baselink));

    contentCell.storeRef(collectionContent);
    contentCell.storeRef(commonContent.asCell());
    data.storeRef(contentCell);

    let NftItemCodeCell = ton_core.Cell.fromBoc(fs.readFileSync("nft-item.boc"))[0];
    data.storeRef(NftItemCodeCell);

    let royaltyBase = 1000;
    let royaltyFactor = Math.floor(royalty * royaltyBase);

    let royaltyCell = ton_core.beginCell();
    royaltyCell.storeUint(royaltyFactor, 16);
    royaltyCell.storeUint(royaltyBase, 16);
    royaltyCell.storeAddress(owner);
    data.storeRef(royaltyCell);

    data = data.endCell();

    let collection = ton_core.contractAddress(0, { code, data });

    if (await client.isContractDeployed(collection)) {

        console.error(`\nerror:\n\tCollection (${collection}) already deployed!\n`);

        process.exit(0);

    }

    let provider = client.provider(collection, {code, data});

    let seqno = await walletContract.getSeqno();

    await provider.internal(walletSender, {
        value: ton.toNano('0.05'),
        bounce: false
    });

    let currentSeqno = seqno;

    while (currentSeqno == seqno) {
        await sleep(500);
        currentSeqno = await walletContract.getSeqno();
    }

    return collection;

}

function createNFT(owner, index, metalink) {

    return ton_core.beginCell()
    .storeUint(1, 32)
    .storeUint(0, 64)
    .storeUint(index, 64)
    .storeCoins(ton.toNano('0.05'))
    .storeRef(ton_core.beginCell()
        .storeAddress(owner)
        .storeRef(ton_core.beginCell().storeBuffer(Buffer.from(metalink)).endCell())
    .endCell()).endCell();

}

async function deployNFT(walletContract, secretKey, collection, index, owner, metalink) {
    
    let body = createNFT(owner, index, metalink);

    let seqno = await walletContract.getSeqno();

    await walletContract.sendTransfer({
        seqno,
        secretKey,
        messages: [
            ton.internal({
                to: collection,
                value: ton.toNano('0.07'),
                bounce: false,
                body
            })
        ]
    });

    let currentSeqno = seqno;

    while (currentSeqno == seqno) {
        await sleep(500);
        currentSeqno = await walletContract.getSeqno();
    }

}


async function deploySale(walletContract, walletSender, owner, nft_address, price, royalty) {
    
    let code = ton_core.Cell.fromBoc(fs.readFileSync("nft-fixprice-sale-v2.boc"))[0];
    let data = ton_core.beginCell()
    .storeUint(0, 1)
    .storeUint(Math.round(Date.now()/1000), 32)
    .storeAddress(owner)
    .storeAddress(nft_address)
    .storeAddress(owner)
    .storeCoins(price)
    .storeRef(ton_core.beginCell()
        .storeAddress(ton.address(`EQCjk1hh952vWaE9bRguFkAhDAL5jj3xj9p0uPWrFBq_GEMS`))
        .storeCoins(BigInt(Number(price)*0.05))
        .storeAddress(owner)
        .storeCoins(BigInt(Number(price)*royalty))
    .endCell())
    .endCell();
    
    let selling = ton_core.contractAddress(0, { code, data });

    if (await client.isContractDeployed(selling)) {

        console.error(`\nerror:\n\Selling contract (${selling}) is already deployed!\n`);

        process.exit(0);

    }

    let provider = client.provider(selling, { code, data });

    let seqno = await walletContract.getSeqno();

    await provider.internal(walletSender, {
        value: ton.toNano('0.05'),
        bounce: false
    });

    let currentSeqno = seqno;

    while (currentSeqno == seqno) {
        await sleep(500);
        currentSeqno = await walletContract.getSeqno();
    }

    return selling;

}


async function transferNFT(walletContract, secretKey, nft_address, new_owner) {

    const body = ton_core.beginCell()
    .storeUint(0x5fcc3d14, 32)
    .storeUint(0, 64)
    .storeAddress(new_owner)
    .storeAddress(walletContract.address)
    .storeBit(false)
    .storeCoins(0)
    .storeBit(0)
    .endCell();

    let seqno = await walletContract.getSeqno();

    await walletContract.sendTransfer({
        seqno,
        secretKey,
        messages: [
            ton.internal({
                to: nft_address,
                value: ton.toNano('0.05'),
                bounce: false,
                body
            })
        ]
    });

    let currentSeqno = seqno;

    while (currentSeqno == seqno) {
        await sleep(500);
        currentSeqno = await walletContract.getSeqno();
    }

}

module.exports = { deployCollection, deployNFT, deploySale, transferNFT };