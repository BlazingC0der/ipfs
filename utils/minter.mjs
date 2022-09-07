import Web3 from "web3"
import NFT from "../contracts/NFT.json" assert { type: "json" }
import "dotenv/config"
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const HDWalletProvider = require("@truffle/hdwallet-provider")

const MintNft = async (uri) => {
    console.log("minting nft...")
    const provider = new HDWalletProvider({
        mnemonic: {
            phrase: process.env.mnemonic
        },
        providerOrUrl: process.env.infura
    })
    const web3 = new Web3(provider)
    const contract = new web3.eth.Contract(NFT.abi, process.env.ContractAddress)
    contract.methods
        .mint(process.env.pbk, uri)
        .send({ from: process.env.pbk }, (err, res) => {
            if (err) {
                console.log(err)
                throw err
            } else {
                console.log("minting successful!")
                console.log("TxHash: ", res)
            }
        })
}

export default MintNft
