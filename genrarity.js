const Moralis = require("moralis/node");
const { timer } = require("rxjs");

// Configure Moralis API key & secret, Moralis Subdomain, AppID and Moralis Server url
const moralisApiKey="";
const moralisApiSecret="";
const moralisSubdomain="";
const appId="";
const serverUrl="";

// kill app if moralis variables are not set
const Rtfm = () => {
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
};
 Rtfm();

 //  login to moralis, go to the "User" table and set username and password for your account
 //  goto the NFT classname you are creating and change the CLP to your username with R/W perms
 const MoralisL="";
 const MoralisP="";

async function MoralisLogin  ()  {
	if ( (MoralisL) == "" ) { console.log("\nRTFM"); console.log("\nMoralis UserName not set"); process.exit(); }
	else if ( (MoralisP) == "" ) { console.log("\nRTFM"); console.log("\nMoralis Password not set"); process.exit(); }
  else  {  const user = await Moralis.User.logIn( MoralisL , MoralisP  ); user.set ( MoralisL, MoralisP  );
  process.stdout.write("\u001b[3J\u001b[2J\u001b[1J"); console.clear();
	};
 };
MoralisLogin();

// Set ACL for Collection:   Public is RO, Role "adminz" has RW
// Create Role in server dashboard under Roles
var acl = new Moralis.ACL(collectionName);
	acl.setPublicReadAccess(true);
	acl.setPublicWriteAccess(false);
	acl.setRoleReadAccess("adminz", true);
	acl.setRoleWriteAccess("adminz", true);

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
	console.log("\n\nPlease wait.. \n\nThis will take a little bit while we analyze your collection\n\nThis will depend on the size of your collection.\n\nYou will see it continue shortly\n\n");
  let allNFTs = NFTs.result;

  const timer = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let i = pageSize; i < totalNum; i = i + pageSize) {
    const NFTs = await Moralis.Web3API.token.getAllTokenIds({
      address: collectionAddress,
      offset: i,
    });
    allNFTs = allNFTs.concat(NFTs.result);
    await timer(6000);
		console.log("Analyzing.....");
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
		await timer(300);
    nftArr[i].Rank = i + 1;
    const newClass = Moralis.Object.extend(collectionName);

		// see if the acl shows down here
			console.log(acl);

	  const newObject = new newClass();
		const query = new Moralis.Query(newClass);
		query.equalTo("tokenId", (nftArr[i].token_id));
		const results = await query.find();
		 if ( (results.length) == 1 ) {
			 console.log("\nSkipping Duplicate"); console.log(nftArr[i].token_id); console.log("\n"); }
		else  {
    newObject.set("attributes", nftArr[i].Attributes); newObject.set("rarity", nftArr[i].Rarity);
    newObject.set("tokenId", nftArr[i].token_id); newObject.set("rank", nftArr[i].Rank);
    newObject.set("image", nftArr[i].image);

    await newObject.save(acl);
		console.log("\nSaved"); console.log(nftArr[i].token_id);
			};
	 };

  return true
}

generateRarity()
.then( ( result ) => { console.log( result ) } )
.catch( ( error ) => { console.log( error ) } )
