const fs = require('fs');
const ton_core = require('ton-core');
const ton_crypto = require('ton-crypto');
const ton = require('ton');
const ton_access = require(`@orbs-network/ton-access`);

const { sleep } = require('./other.js');
const { deployCollection, deployNFT, deploySale } = require('./deploy.js');
const config = JSON.parse(fs.readFileSync(`config.json`));

(async () => {

    if(config.network !== 'mainnet' && config.network !== 'testnet') return console.error(`\nerror:\n\t"network" param must be "mainnet"/"testnet"!\n`);
    if(config.wallet_version !== 'v4' && config.wallet_version !== 'v3r2' && config.wallet_version !== 'v3r1') return console.error(`\nerror:\n\t"wallet_contract" param must be "v4"/"v3r2"/"v3r1"!\n`);
    if(!config.deploy_collection.need && !config.deploy_nft) return console.error(`\nerror:\n\tnothing to do!\n`);
    if(config.deploy_collection.need && (!config.deploy_collection.meta_link || !config.deploy_collection.base_link)) return console.error(`\nerror:\n\trequired by "deploy_collection" params: "meta_link", "base_link"!\n`);
    if(config.deploy_nft) for(nft of config.nft) {
        
        if(!nft.meta_path) return console.error(`\nerror:\n\tparam "meta_path" required by nft item object in "nft" array!\n`);

    }

    if(config.network === 'mainnet') client = new ton.TonClient({ endpoint: await ton_access.getHttpEndpoint({ network: "mainnet" }) }); else client = new ton.TonClient({ endpoint: await ton_access.getHttpEndpoint({ network: "testnet" }) });


    //return console.log((await client.callGetMethod('EQBjrDIuwOVOfnsGHNrCgy-IvERx-OJW9bJQRh7tZxyw9MG_', 'get_collection_data')).stack.items[1].cell.asSlice().loadStringTail());

    let key = await ton_crypto.mnemonicToWalletKey(config.mnemonic.split(" "));
    let wallet;

    if(config.wallet_version === 'v4') wallet = ton.WalletContractV4; else if(config.wallet_version === 'v3r2') wallet = ton.WalletContractV3R2; else if(config.wallet_version === 'v3r1') wallet = ton.WalletContractV3R1;

    wallet = wallet.create({ publicKey: key.publicKey, workchain: 0 });

    if (!await client.isContractDeployed(wallet.address)) return console.error(`\nerror:\n\twallet on this mnemonic (${wallet.address}) is not deployed!\n`);

    console.log(`\nwallet: ${wallet.address}\n`);

    let walletContract = client.open(wallet),
    walletSender = walletContract.sender(key.secretKey),
    default_owner = wallet.address,
    owner,
    collection,
    index,
    nft_address,
    sale_address,
    time1,
    royalty;

    if(config.deploy_collection.need) {

        collection = await deployCollection(walletContract, walletSender, (config.deploy_collection.owner ? config.deploy_collection.owner : default_owner), config.deploy_collection.royalty, config.deploy_collection.meta_link, config.deploy_collection.base_link);
        royalty = config.deploy_collection.royalty;
        index = 0;

    } else {

        try {

            collection = ton.address(config.collection);

        } catch {

            return console.error(`\nerror:\n\tcollection address (${config.collection}) is invalid!\n`);

        }


        if (!await client.isContractDeployed(collection)) return console.error(`\nerror:\n\tcollection (${collection}) is not deployed!\n`);


        try {
        
            index = Number((await client.callGetMethod(collection, 'get_collection_data')).stack.items[0].value);
            royalty = (await client.callGetMethod(collection, 'royalty_params')).stack.items;
            royalty = Number(royalty[0].value) / Number(royalty[1].value);
    
        } catch {
    
            return console.error(`\nerror:\n\tcollection (${collection}) doesn't response!\n`);
    
        }

    }

    console.log(`\collection: ${collection}\n`);

    
    if(config.deploy_nft) for(let i = 0; i < config.nft.length; i++) {

        let nft = config.nft[i];
        
        if(nft.price) {

            if(!nft.count) {

                try {

                    time1 = Date.now();
        
                    nft_address = (await client.callGetMethod(collection, 'get_nft_address_by_index', [{type: 'int', value: BigInt(index)}])).stack.items[0].cell.asSlice().loadAddress();
        
                    if(nft.owner) {

                        try {

                            owner = ton.address(nft.owner);

                        } catch {

                            return console.error(`\nerror:\n\tNFT owner address (${nft.owner}) is invalid!\n`);
                
                        }

                    } else owner = default_owner;

                    sale_address = await deploySale(walletContract, walletSender, owner, nft_address, ton.toNano(`${nft.price}`), royalty);
        
                    console.log(`Deploying NFT contract (${nft_address})`);
        
                    await deployNFT(walletContract, key.secretKey, collection, index, sale_address, nft.meta_path);
        
                    console.log(`Deployed ${index} NFT in ${(Date.now()-time1)/1000} sec\n`);

                    index++;
        
                } catch(err) {
        
                    console.log(`\n\n\nerror while minting!\n\n\n`, err);
        
                    i--;
        
                }

            } else for(let i2 = 0; i2 < nft.count; i2++) {

                try {

                    time1 = Date.now();
        
                    nft_address = (await client.callGetMethod(collection, 'get_nft_address_by_index', [{type: 'int', value: BigInt(index)}])).stack.items[0].cell.asSlice().loadAddress();
        
                    if(nft.owner) {

                        try {

                            owner = ton.address(nft.owner);

                        } catch {

                            return console.error(`\nerror:\n\tNFT owner address (${nft.owner}) is invalid!\n`);
                
                        }

                    } else owner = default_owner;

                    sale_address = await deploySale(walletContract, walletSender, owner, nft_address, ton.toNano(`${nft.price}`), royalty);
        
                    console.log(`Deploying NFT contract (${nft_address})`);
        
                    await deployNFT(walletContract, key.secretKey, collection, index, sale_address, nft.meta_path);
        
                    console.log(`Deployed ${index} NFT in ${(Date.now()-time1)/1000} sec\n`);

                    index++;
        
                } catch(err) {
        
                    console.log(`\n\n\nerror while minting!\n\n\n`);
        
                    i2--;
        
                }

            }

        }

    }

})();