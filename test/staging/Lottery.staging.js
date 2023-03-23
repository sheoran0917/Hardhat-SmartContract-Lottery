const { inputToConfig } = require("@ethereum-waffle/compiler")
const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network, deployments } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery", () => {
          let deployer
          let lottery
          let lotteryEntraceFee
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              lottery = await ethers.getContract("Lottery", deployer)
              lotteryEntraceFee = await lottery.getEntranceFee()
          })
          describe("fulfillRandomWords", function () {
              it("Live chainlink keepers and chainlink VRF", async () => {
                  const startingTimestamp = await lottery.getLastTimeStamp()
                  const accounts = await ethers.getSigners()

                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("Winner picked!!")

                          try {
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const winnerBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await lottery.getLastTimeStamp()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(lotteryState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance.add(lotteryEntraceFee).toString()
                              )
                              resolve()
                          } catch (e) {
                              reject(e)
                          }
                      })
                      await lottery.enterLottery({ value: lotteryEntraceFee })
                      const startingBalance = await accounts[0].getBalance()
                  })
              })
          })
      })
