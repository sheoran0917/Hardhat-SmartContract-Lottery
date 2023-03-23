const { inputToConfig } = require("@ethereum-waffle/compiler")
const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network, deployments } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery", () => {
          let deployer
          let lottery
          let vrfCoordinatorV2Mock
          let interval
          let lotteryEntraceFee
          const chainId = network.config.chainId
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              lottery = await ethers.getContract("Lottery", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              interval = await lottery.getInterval()
              lotteryEntraceFee = await lottery.getEntranceFee()
          })
          describe("Constructor", async () => {
              it("Check if interval is setting correct", async function () {
                  const response = await lottery.getInterval()
                  assert.equal(response.toString(), networkConfig[chainId]["interval"])
              })
              it("Check if the VRF Coordinator address is correct", async function () {
                  const response = await lottery.getvrfCoordinatoraddress()
                  assert.equal(response, vrfCoordinatorV2Mock.address)
              })
              it("Check if lottery is open", async function () {
                  const response = await lottery.getLotteryState()
                  assert.equal(response.toString(), "0")
              })
          })
          describe("enterLottery", async () => {
              it("check if we can enter the lottery", async function () {
                  const response = await lottery.enterLottery({
                      value: lotteryEntraceFee,
                  })
                  const playerResponse = await lottery.getPlayer(0)
                  assert.equal(playerResponse, deployer)
              })
              it("check if pay the correct enetrence fee", async function () {
                  await expect(lottery.enterLottery()).to.be.revertedWith(
                      "Lottery__NotEnoughEthEntered"
                  )
              })
              it("emits event on enter", async () => {
                  await expect(
                      lottery.enterLottery({
                          value: lotteryEntraceFee,
                      })
                  ).to.emit(
                      // emits lotteryEnter event if entered to index player(s) address
                      lottery,
                      "LotteryEnter"
                  )
              })
              it("doesn't allow entrance when lottery is calculating", async () => {
                  await lottery.enterLottery({
                      value: lotteryEntraceFee,
                  })
                  // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  // we pretend to be a keeper for a second
                  await lottery.performUpkeep([]) // changes the state to calculating for our comparison below
                  await expect(
                      lottery.enterLottery({
                          value: lotteryEntraceFee,
                      })
                  ).to.be.revertedWith(
                      // is reverted as lottery is calculating
                      "Lottery__NotOpen"
                  )
              })
          })
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded)
              })
              it("returns false if lottery isn't open", async () => {
                  await lottery.enterLottery({
                      value: lotteryEntraceFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await lottery.performUpkeep([]) // changes the state to calculating
                  const lotteryState = await lottery.getLotteryState() // stores the new state
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert.equal(lotteryState.toString() == "1", upkeepNeeded == false)
              })
              it("returns false if enough time hasn't passed", async () => {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded)
              })
          })
          describe("performUpkeep", function () {
              it("can only run if checkupkeep is true", async () => {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const tx = await lottery.performUpkeep("0x")
                  assert(tx)
              })
              it("reverts if checkup is false", async () => {
                  await expect(lottery.performUpkeep("0x")).to.be.revertedWith(
                      "Lottery__UpKeepNotNeeded"
                  )
              })
              it("updates the lottery state and emits a requestId", async () => {
                  // Too many asserts in this test!
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const txResponse = await lottery.performUpkeep("0x") // emits requestId
                  const txReceipt = await txResponse.wait(1) // waits 1 block
                  const lotteryState = await lottery.getLotteryState() // updates state
                  const requestId = txReceipt.events[1].args.requestId
                  assert(requestId.toNumber() > 0)
                  assert(lotteryState == 1) // 0 = open, 1 = calculating
              })
          })
          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await lottery.enterLottery({ value: lotteryEntraceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
              })
              it("can only be called after performupkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address) // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address) // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request")
              })
              it("picks a winner, resest the lottery and send the money", async () => {
                  const addtionalEntreants = 3
                  const startingAccountIndex = 1 // deployer is 0
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < addtionalEntreants + addtionalEntreants;
                      i++
                  ) {
                      const accountConnectedLotery = lottery.connect(accounts[i])
                      await accountConnectedLotery.enterLottery({ value: lotteryEntraceFee })
                  }
                  const startingTimeStamp = await lottery.getLastTimeStamp()
                  //performUpKeep (mock being the chainlink keepers)
                  //fulfillRandomWords (mock being the chainlink VRF)
                  // We will have to wait for the fullfillRandom words to be called.
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("Found the event!!!")
                          try {
                              console.log(accounts[2].address)
                              console.log(accounts[0].address)
                              console.log(accounts[1].address)
                              console.log(accounts[3].address)

                              const recentWinner = await lottery.getRecentWinner()
                              console.log(`winner is ${recentWinner}`)
                              console.log(deployer)
                              const lotteryState = await lottery.getLotteryState()
                              const endingTimeStamp = await lottery.getLastTimeStamp()
                              const numPlayers = await lottery.getNumberofPlayers()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(lotteryState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })
                      const tx = await lottery.performUpkeep([])
                      const txReceipt = await tx.wait(1)
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          lottery.address
                      )
                  })
              })
          })
      })
