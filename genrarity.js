const Moralis = require("moralis/node");
const { timer } = require("rxjs");

// Configure Moralis API key & secret, Moralis Subdomain, AppID and Moralis Server url
const moralisApiKey="cgTSeUPt1xDTUnnF4gREYwwQooOwuDQmD4pEidBsUdOjPd3ZwOBL5YgDcJzoRZn1";
const moralisApiSecret="nB3JOzCtHHioo7a";
const moralisSubdomain="xgrnb3wixiuc.usemoralis.com";
const appId="7nsBEikxyRplmYy3sEzruswk7BmuU2OPAnnsJJ2I";
const serverUrl="https://xgrnb3wixiuc.usemoralis.com:2053/server";

// kill app if moralis variables are not set
const rtfm = () => {
	if ( (serverUrl) == "" ) { console.log("\nRTFM"); console.log("\nMoralis serverUrl not set"); process.exit(); }
	else if ( (appId) == "" ) { console.log("\nRTFM"); console.log("\nMoralis appId not set"); process.exit(); }
	else if ( (moralisApiKey) == "" ) { console.log("\nRTFM"); console.log("\nMoralis ApiKey not set"); process.exit(); }
	else if ( (moralisApiSecret) == "" ) { console.log("\nRTFM"); console.log("\nMoralis ApiSecret not set"); process.exit(); }
  else  {
	 console.log("Moralis AppID"); console.log(appId);
	 console.log("\nMoralis URL"); console.log(serverUrl);
	 console.log("\nInitializing Application\n"); Moralis.start({ serverUrl, appId, moralisApiKey});
	 process.stdout.write("\u001b[3J\u001b[2J\u001b[1J"); console.clear();
	}
}
rtfm()

// Configure NFT Collection ~
const collectionAddress = "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d";
const collectionName = "BAYC";

const resolveLink = (url) => {
  if (!url || !url.includes("ipfs://")) return url;
  return url.replace("ipfs://", "https://gateway.ipfs.io/ipfs/");
};

async function generateRarity() {
  const NFTs = await Moralis.Web3API.token.getAllTokenIds({
    address: collectionAddress,
  });

  const totalNum = NFTs.total;
  const pageSize = NFTs.page_size;
	console.log("\nCollection Name:"); console.log(collectionName);
	console.log("\nTotal NFTs in Collection"); console.log(totalNum);
	console.log("\nTotal per page"); console.log(pageSize);
	console.log("\n\nPlease wait.. \n\nThis will take a little bit while we analyze your collection\n\nYou will see it continue shortly\n\n");
  let allNFTs = NFTs.result;

  const timer = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let i = pageSize; i < totalNum; i = i + pageSize) {
    const NFTs = await Moralis.Web3API.token.getAllTokenIds({
      address: collectionAddress,
      offset: i,
    });
    allNFTs = allNFTs.concat(NFTs.result);
    await timer(5000);
  }

  let metadata = allNFTs.map((e) => JSON.parse(e.metadata).attributes);

  let tally = { TraitCount: {} };

  for (let j = 0; j < metadata.length; j++) {
    let nftTraits = metadata[j].map((e) => e.trait_type);
    let nftValues = metadata[j].map((e) => e.value);

    let numOfTraits = nftTraits.length;

    if (tally.TraitCount[numOfTraits]) {
      tally.TraitCount[numOfTraits]++;
    } else {
      tally.TraitCount[numOfTraits] = 1;
    }

    for (let i = 0; i < nftTraits.length; i++) {
      let current = nftTraits[i];
      if (tally[current]) {
        tally[current].occurences++;
      } else {
        tally[current] = { occurences: 1 };
      }

      let currentValue = nftValues[i];
      if (tally[current][currentValue]) {
        tally[current][currentValue]++;
      } else {
        tally[current][currentValue] = 1;
      }
    }
  }

  const collectionAttributes = Object.keys(tally);
  let nftArr = [];
  for (let j = 0; j < metadata.length; j++) {
    let current = metadata[j];
    let totalRarity = 0;
    for (let i = 0; i < current.length; i++) {
      let rarityScore =
        1 / (tally[current[i].trait_type][current[i].value] / totalNum);
      current[i].rarityScore = rarityScore;
      totalRarity += rarityScore;
    }

    let rarityScoreNumTraits =
      8 * (1 / (tally.TraitCount[Object.keys(current).length] / totalNum));
    current.push({
      trait_type: "TraitCount",
      value: Object.keys(current).length,
      rarityScore: rarityScoreNumTraits,
    });
    totalRarity += rarityScoreNumTraits;

    if (current.length < collectionAttributes.length) {
      let nftAttributes = current.map((e) => e.trait_type);
      let absent = collectionAttributes.filter(
        (e) => !nftAttributes.includes(e)
      );

      absent.forEach((type) => {
        let rarityScoreNull =
          1 / ((totalNum - tally[type].occurences) / totalNum);
        current.push({
          trait_type: type,
          value: null,
          rarityScore: rarityScoreNull,
        });
        totalRarity += rarityScoreNull;
      });
    }

    if (allNFTs[j].metadata) {
      allNFTs[j].metadata = JSON.parse(allNFTs[j].metadata);
      allNFTs[j].image = resolveLink(allNFTs[j].metadata.image);
    } else if (allNFTs[j].token_uri) {
      try {
        await fetch(allNFTs[j].token_uri)
          .then((response) => response.json())
          .then((data) => {
            allNFTs[j].image = resolveLink(data.image);
          });
      } catch (error) {
        console.log(error);
      }
    }

    nftArr.push({
      Attributes: current,
      Rarity: totalRarity,
      token_id: allNFTs[j].token_id,
      image: allNFTs[j].image,
    });
  }

  nftArr.sort((a, b) => b.Rarity - a.Rarity);


  for (let i = 0; i < nftArr.length; i++) {
    nftArr[i].Rank = i + 1;
    const newClass = Moralis.Object.extend(collectionName);
    const newObject = new newClass();

			const query = new Moralis.Query(newClass);
			query.equalTo("tokenId", (nftArr[i].token_id));
			console.log("Processing:");
			// console.log(nftArr[i].token_id);
			const results = await query.find();
			//console.log(results.length);
			 if ( (results.length) == 1 ) {
				 console.log("\nSkipping Duplicate");
				 console.log(nftArr[i].token_id);
				 console.log("\n");
				 }
			else  {
    newObject.set("attributes", nftArr[i].Attributes);
    newObject.set("rarity", nftArr[i].Rarity);
    newObject.set("tokenId", nftArr[i].token_id);
    newObject.set("rank", nftArr[i].Rank);
    newObject.set("image", nftArr[i].image);
   // Wait (in ms) between saves to not piss off moralis rate limiting (as much) :P
	 // Your results will probably vary ¯\_(ツ)_/¯
    await timer(500);
    await newObject.save();
		console.log("\nSaved")
			};
	 };

  return true
}

generateRarity()
.then( ( result ) => { console.log( result ) } )
.catch( ( error ) => { console.log( error ) } )
