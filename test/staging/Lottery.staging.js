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
                              console.log(recentWinner)
                              console.log(accounts[0].address)
                              console.log(`Ending balance is ${winnerBalance.toString()}`)
                              assert.equal(lotteryState.toString(), "0")
                              await expect(lottery.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance.add(lotteryEntraceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimestamp)
                              resolve()
                          } catch (e) {
                              reject(e)
                          }
                      })
                      console.log("Entering Lottery...")
                      const tx = await lottery.enterLottery({ value: lotteryEntraceFee })
                      await tx.wait(1)
                      const startingBalance = await accounts[0].getBalance()
                      console.log(`Starting balance is ${startingBalance.toString()}`)
                  })
              })
          })
      })
