const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") //.25 is the premium. It costs .25 link per request.
const GAS_PRICE_LINK = 1e9 //link per gas. calculated value based on the gas price of the chain
//ETH price rises the gas price also rises
//chainlink nodes pay the gas fees to give us randomness and do external execition
//So the price of request changes as the price of the gas.
module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if (developmentChains.includes(network.name)) {
        log("Local network detected!! Deploying mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("Mocks deployed")
    }
}

module.exports.tags = ["all", "mocks"]
