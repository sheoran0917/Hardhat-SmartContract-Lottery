const { ethers, network } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESS_FILE =
    "../nextjs-smartcontrat-lottery-updated/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-smartcontrat-lottery-updated/constants/abi.json"
module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("updating front end")
        updateContractAddresses()
        updateAbi()
    }
}

async function updateAbi() {
    const lottery = await ethers.getContract("Lottery")
    fs.writeFileSync(FRONT_END_ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.json))
}
async function updateContractAddresses() {
    const lottery = await ethers.getContract("Lottery")
    const chainId = network.config.chainId.toString()
    const currentAddress = JSON.parse(fs.readFileSync(FRONT_END_ADDRESS_FILE), "utf8")
    if (chainId in currentAddress) {
        if (!currentAddress[chainId].includes(lottery.address)) {
            currentAddress[chainId].push(lottery.address)
        }
    }
    {
        currentAddress[chainId] = [lottery.address]
    }
    fs.writeFileSync(FRONT_END_ADDRESS_FILE, JSON.stringify(currentAddress))
}

module.exports.tags = ["all", "frontend"]
