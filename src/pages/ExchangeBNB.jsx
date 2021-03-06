import React, { Component } from "react";
import Swap from "../components/exchange/Swap";
import { withRouter } from "react-router";
import { TOKENS } from "../utils/appTokens";
import {
	approveToken,
	checkIntermediaryLiquidity,
	estimateInAmounts,
	estimateOutAmounts,
	fetchImportedTokens,
	getBNBBalance,
	getLPAddress,
	getLPInfo,
	getTokenApproval,
	getTokenBalance,
	MULTIPATH_TOKENS,
	searchToken,
	storeImportedTokens,
	swapBNBForTokens,
	swapTokens,
	swapTokensForBNB,
} from "../utils/helpers";
import { CircularProgress, Container } from "@material-ui/core";
import { notification, Tooltip } from "antd";
import moment from "moment";
import { AiOutlineQuestionCircle } from "react-icons/ai";
import { GrPowerCycle } from "react-icons/gr";
import AppContext from "../state/AppContext";
import { PROVIDER, WBNB_ADDRESS } from "../utils/contracts";
import queryString from "query-string";
import Sidebar from "../components/Sidebar";
import AppBar from "../components/AppBar";
import { ApproveModal, ConfirmSwapModal } from "../components/modals";
import ExternalLink from "../components/Transactions/ExternalLink";

var timerA = null;
var timerB = null;
class ExchangeBNB extends Component {
	static contextType = AppContext;

	constructor(props) {
		super(props);
		this.state = {
			loading: false,
			fetchingTokenA: false,
			fetchingTokenB: false,
			tokenA: TOKENS[0].symbol,
			tokenAAddress: TOKENS[0].contractAddress,
			tokenAIcon: TOKENS[0].icon,
			tokenADecimals: TOKENS[0].decimals,
			tokenABalance: "",
			tokenAAmount: "",
			tokenAAllowance: "",
			tokenAApproved: false,
			approvingTokenA: false,
			tokenAPrice: "",
			tokenB: "",
			tokenBAddress: "",
			tokenBIcon: "",
			tokenBDecimals: "",
			tokenBBalance: "",
			tokenBAmount: "",
			tokenBAllowance: "",
			tokenBApproved: false,
			approvingTokenB: false,
			tokenBPrice: "",
			liquidityInfo: null,
			tokenASupply: "",
			tokenBSupply: "",
			swapping: false,
			approvalModalVisible: false,
			approvalToken: "",
			approvalAmount: "",
			approving: false,
			fetchingLiquidity: false,
			fetchingPrices: false,
			impact: "",
			inverted: false,
			invalidPair: false,
			confirmationModalVisible: false,
			multipathSwap: false,
			multipathToken: "",
		};
	}

	componentDidMount() {
		const {
			walletAddress,
			history: { location },
		} = this.props;
		let params = queryString.parse(location.search);
		const fromAddress = params.from;
		const toAddress = params.to;
		if (fromAddress || toAddress) {
			this.setTokensFromURL(fromAddress, toAddress);
		} else {
			this.props.history.replace("/swap");
		}
		if (walletAddress) {
			const importedTokens = fetchImportedTokens();
			let allTokens = [...TOKENS];
			if (importedTokens) {
				allTokens = [...TOKENS, ...importedTokens.data];
			}
			const selectedToken = allTokens.filter((token) => token.symbol === this.state.tokenA);
			if (selectedToken[0].symbol === "BNB") {
				this.fetchBNBBalance("A");
			} else {
				this.fetchBalance(
					walletAddress,
					selectedToken[0].contractAddress,
					selectedToken[0].contractABI,
					selectedToken[0].decimals,
					"A"
				);
				this.fetchApproval(
					walletAddress,
					selectedToken[0].contractAddress,
					selectedToken[0].decimals,
					"A"
				);
			}
		}
	}

	componentDidUpdate(prevProps) {
		const { walletAddress } = this.props;
		const { tokenA, tokenB } = this.state;
		if (walletAddress !== prevProps.walletAddress && walletAddress) {
			const importedTokens = fetchImportedTokens();
			let allTokens = [...TOKENS];
			if (importedTokens) {
				allTokens = [...TOKENS, ...importedTokens.data];
			}
			if (tokenA) {
				const selectedToken = allTokens.filter((token) => token.symbol === this.state.tokenA);
				if (selectedToken[0].symbol === "BNB") {
					this.fetchBNBBalance("A");
				} else {
					this.fetchBalance(
						walletAddress,
						selectedToken[0].contractAddress,
						selectedToken[0].contractABI,
						selectedToken[0].decimals,
						"A"
					);
					this.fetchApproval(
						walletAddress,
						selectedToken[0].contractAddress,
						selectedToken[0].decimals,
						"A"
					);
				}
			}
			if (tokenB) {
				const selectedToken = allTokens.filter((token) => token.symbol === tokenB);
				if (selectedToken[0].symbol === "BNB") {
					this.fetchBNBBalance("B");
				} else {
					this.fetchBalance(
						walletAddress,
						selectedToken[0].contractAddress,
						selectedToken[0].contractABI,
						selectedToken[0].decimals,
						"B"
					);
					this.fetchApproval(
						walletAddress,
						selectedToken[0].contractAddress,
						selectedToken[0].decimals,
						"B"
					);
				}
			}
			if (tokenA && tokenB) {
				this.fetchLiquidity();
			}
		} else if (walletAddress !== prevProps.walletAddress && !walletAddress) {
			this.setState({
				tokenAAmount: "",
				tokenABalance: "",
				tokenAAllowance: "",
				tokenBAmount: "",
				tokenBBalance: "",
				tokenBAllowance: "",
				liquidityInfo: null,
				lpAddress: "",
				impact: "",
				invalidPair: false,
				tokenAPrice: "",
				tokenBPrice: "",
				tokenASupply: "",
				tokenBSupply: "",
				inverted: false,
			});
		}
	}

	setTokensFromURL = (from, to) => {
		const { history } = this.props;
		const importedTokens = fetchImportedTokens();
		let allTokens = [...TOKENS];
		if (importedTokens) {
			allTokens = [...TOKENS, ...importedTokens.data];
		}
		if (from && to) {
			if (from !== to) {
				const tokenAExists = allTokens.filter((token) => token.contractAddress === from);
				const tokenBExists = allTokens.filter((token) => token.contractAddress === to);
				if (tokenAExists.length > 0) {
					this.updateTokenA(tokenAExists[0]);
				} else {
					this.setState({ fetchingTokenA: true }, () => {
						searchToken(from)
							.then((response) => {
								this.setState({ fetchingTokenA: false }, () => {
									if (response.success) {
										this.storeToken(response.data);
										this.updateTokenA(response.data);
									}
								});
							})
							.catch((_) => {
								this.setState({ fetchingTokenA: false }, () => {
									history.replace("/swap");
								});
							});
					});
				}
				if (tokenBExists.length > 0) {
					this.updateTokenB(tokenBExists[0]);
				} else {
					this.setState({ fetchingTokenB: true }, () => {
						searchToken(to)
							.then((response) => {
								this.setState({ fetchingTokenB: false }, () => {
									if (response.success) {
										this.storeToken(response.data);
										this.updateTokenB(response.data);
									}
								});
							})
							.catch((_) => {
								this.setState({ fetchingTokenB: false }, () => {
									history.replace("/swap");
								});
							});
					});
				}
			} else {
				history.replace(`/swap?from=${from}`);
			}
		} else if (!to) {
			const tokenAExists = allTokens.filter((token) => token.contractAddress === from);
			if (tokenAExists.length > 0) {
				this.updateTokenA(tokenAExists[0]);
			} else {
				this.setState({ fetchingTokenA: true }, () => {
					searchToken(from)
						.then((response) => {
							this.setState({ fetchingTokenA: false }, () => {
								if (response.success) {
									this.storeToken(response.data);
									this.updateTokenA(response.data);
								}
							});
						})
						.catch((_) => {
							this.setState({ fetchingTokenA: false }, () => {
								history.replace("/swap");
							});
						});
				});
			}
		} else if (!from) {
			const tokenBExists = allTokens.filter((token) => token.contractAddress === to);
			if (tokenBExists.length > 0) {
				this.updateTokenB(tokenBExists[0]);
			} else {
				this.setState({ fetchingTokenB: true }, () => {
					searchToken(to)
						.then((response) => {
							this.setState({ fetchingTokenB: false }, () => {
								if (response.success) {
									this.storeToken(response.data);
									this.updateTokenB(response.data);
								}
							});
						})
						.catch((_) => {
							this.setState({ fetchingTokenB: false }, () => {
								history.replace("/swap");
							});
						});
				});
			}
		}
	};

	storeToken = (newToken) => {
		let importedTokens = fetchImportedTokens();
		if (importedTokens) {
			importedTokens.data.push(newToken);
			storeImportedTokens(importedTokens);
		} else {
			const newImportedToken = {
				data: [newToken],
			};
			storeImportedTokens(newImportedToken);
		}
	};

	fetchBalance = (walletAddress, contractAddress, contractABI, decimals, token) => {
		getTokenBalance(walletAddress, contractAddress, contractABI, decimals)
			.then((res) => {
				if (res.success) {
					this.setState({
						[token === "A" ? "tokenABalance" : "tokenBBalance"]: res.balance,
					});
				}
			})
			.catch((err) => {
				// console.log("Unable to fetch balance", err.message);
			});
	};

	fetchBNBBalance = (token) => {
		getBNBBalance(this.props.walletAddress)
			.then((res) => {
				// console.log(res)
				if (res.success) {
					this.setState({
						[token === "A" ? "tokenABalance" : "tokenBBalance"]: res.balance,
					});
				}
			})
			.catch((err) => {
				// console.log("Unable to fetch balance", err.message);
			});
	};

	fetchApproval = (walletAddress, contractAddress, decimals, token) => {
		this.setState({ loading: true }, () => {
			getTokenApproval(walletAddress, contractAddress, decimals)
				.then((allowance) => {
					this.setState({ loading: false }, () => {
						// console.log(token, allowance);
						if (parseFloat(allowance) > 0) {
							this.setState({
								[token === "A" ? "tokenAApproved" : "tokenBApproved"]: true,
								[token === "A" ? "tokenAAllowance" : "tokenBAllowance"]: allowance,
							});
						} else {
							this.setState({
								[token === "A" ? "tokenAAllowance" : "tokenBAllowance"]: allowance,
							});
						}
					});
				})
				.catch((_) => {
					this.setState({ loading: false });
				});
		});
	};

	fetchLiquidity = async () => {
		const { tokenAAddress, tokenBAddress, tokenA, tokenB } = this.state;
		if (tokenAAddress && tokenBAddress) {
			this.setState({ fetchingLiquidity: true }, async () => {
				getLPAddress(tokenAAddress, tokenBAddress)
					.then((lpAddress) => {
						if (lpAddress === "0x0000000000000000000000000000000000000000") {
							if (tokenA === "BNB" || tokenB === "BNB") {
								this.setState({
									multipathSwap: false,
									multipathToken: "",
									fetchingLiquidity: false,
									liquidityInfo: null,
								});
							} else if (tokenA === "WBNB" || tokenB === "BNB") {
								this.setState({
									multipathSwap: false,
									multipathToken: "",
									fetchingLiquidity: false,
									liquidityInfo: null,
								});
							} else {
								this.checkMultiPath();
							}
						} else {
							getLPInfo(lpAddress, this.props.walletAddress, tokenAAddress, tokenBAddress)
								.then((liquidityInfo) => {
									this.setState({
										multipathSwap: false,
										multipathToken: "",
										fetchingLiquidity: false,
										liquidityInfo: liquidityInfo.data,
										tokenASupply: liquidityInfo.data.A,
										tokenBSupply: liquidityInfo.data.B,
									});
								})
								.catch((err) => {
									this.setState(
										{
											fetchingLiquidity: false,
											liquidityInfo: null,
											multipathSwap: false,
											multipathToken: "",
										},
										() => {
											// console.log(err.message);
										}
									);
								});
						}
					})
					.catch((err) => {
						this.setState(
							{
								fetchingLiquidity: false,
								liquidityInfo: null,
								multipathSwap: false,
								multipathToken: "",
							},
							() => {
								// console.log(err);
							}
						);
					});
			});
		}
	};

	checkMultiPath = async () => {
		try {
			const { tokenA, tokenAAddress, tokenADecimals, tokenB, tokenBAddress } = this.state;
			const { walletAddress } = this.props;
			let prices = [];
			const tokens = {
				A: {
					name: tokenA,
					address: tokenAAddress,
				},
				B: {
					name: tokenB,
					address: tokenBAddress,
				},
			};
			await Promise.all(
				MULTIPATH_TOKENS.filter((token) => token.name !== tokenA && token.name !== tokenB).map(
					async ({ name, address }) => {
						const result = await checkIntermediaryLiquidity(name, address, tokens, walletAddress);
						if (result.data) {
							prices.push({
								name: name,
								address: address,
								liquidityInfo: result.data.liquidityInfo,
								tokenASupply: result.data.tokenASupply,
								tokenBSupply: result.data.tokenBSupply,
							});
						}
					}
				)
			);
			if (prices.length > 0) {
				prices.sort((a, b) => parseFloat(a.tokenASupply) - parseFloat(b.tokenASupply));
				const tokenAAmount = parseFloat(prices[0].tokenASupply) * (10 / 100);
				const newPrices = await Promise.all(
					prices.map(async (token) => {
						const tokenBAmountResult = await estimateOutAmounts({
							amount: tokenAAmount.toString(),
							addresses: [tokenAAddress, token.address, tokenBAddress],
							decimals: tokenADecimals,
							token: tokenA,
						});
						return {
							...token,
							price: parseFloat(tokenBAmountResult.amount) / tokenAAmount,
						};
					})
				);
				newPrices.sort((a, b) => b.price - a.price);
				this.setState({
					fetchingLiquidity: false,
					multipathSwap: true,
					multipathToken: newPrices[0].name,
					liquidityInfo: newPrices[0].liquidityInfo,
					tokenASupply: newPrices[0].tokenASupply,
					tokenBSupply: newPrices[0].tokenBSupply,
				});
			} else {
				this.setState({
					fetchingLiquidity: false,
					multipathSwap: false,
					multipathToken: "",
					liquidityInfo: null,
					tokenASupply: "",
					tokenBSupply: "",
				});
			}
		} catch (_) {
			this.setState({
				multipathSwap: false,
				multipathToken: "",
				fetchingLiquidity: false,
				liquidityInfo: null,
			});
		}
	};

	fetchPrices = () => {
		const { tokenAAmount, tokenBAmount, tokenAAddress, tokenBAddress } = this.state;
		if (tokenAAddress && tokenBAddress) {
			const tokenAPrice = parseFloat(tokenBAmount) / parseFloat(tokenAAmount);
			const tokenBPrice = parseFloat(tokenAAmount) / parseFloat(tokenBAmount);
			this.setState({
				fetchingPrices: false,
				tokenAPrice: tokenAPrice,
				tokenBPrice: tokenBPrice,
				invalidPair: false,
			});
		}
	};

	updateTokenA = (token) => {
		const { walletAddress, walletConnected } = this.props;
		const { tokenB, tokenAAmount } = this.state;
		if (token.symbol !== tokenB) {
			this.setState(
				{
					tokenA: token.symbol,
					tokenAIcon: token.icon,
					tokenADecimals: token.decimals,
					tokenAAddress: token.contractAddress,
					multipathSwap: false,
					multipathToken: "",
					tokenAPrice: "",
					tokenBPrice: "",
				},
				() => {
					if (walletConnected) {
						this.fetchLiquidity();
						if (token.symbol === "BNB") {
							this.fetchBNBBalance("A");
						} else {
							this.fetchBalance(
								walletAddress,
								token.contractAddress,
								token.contractABI,
								token.decimals,
								"A"
							);
							this.fetchApproval(walletAddress, token.contractAddress, token.decimals, "A");
						}
						if (tokenAAmount) {
							this.estimate("A");
						}
					}
				}
			);
		} else {
			this.swapTokensInternal();
		}
	};

	updateTokenB = (token) => {
		const { walletAddress, walletConnected } = this.props;
		const { tokenA, tokenAAmount } = this.state;
		if (token.symbol !== tokenA) {
			this.setState(
				{
					tokenB: token.symbol,
					tokenBIcon: token.icon,
					tokenBDecimals: token.decimals,
					tokenBAddress: token.contractAddress,
					multipathSwap: false,
					multipathToken: "",
					tokenAPrice: "",
					tokenBPrice: "",
				},
				() => {
					if (walletConnected) {
						this.fetchLiquidity();
						if (token.symbol === "BNB") {
							this.fetchBNBBalance("B");
						} else {
							this.fetchBalance(
								walletAddress,
								token.contractAddress,
								token.contractABI,
								token.decimals,
								"B"
							);
							this.fetchApproval(walletAddress, token.contractAddress, token.decimals, "B");
						}
						if (tokenAAmount) {
							this.estimate("A");
						}
					}
				}
			);
		} else {
			this.swapTokensInternal();
		}
	};

	swapTokensInternal = () => {
		const {
			tokenA,
			tokenAIcon,
			tokenB,
			tokenBIcon,
			tokenAAddress,
			tokenBAddress,
			tokenADecimals,
			tokenBDecimals,
		} = this.state;
		const { walletConnected } = this.props;
		this.setState(
			{
				tokenB: tokenA,
				tokenBAddress: tokenAAddress,
				tokenBIcon: tokenAIcon,
				tokenBDecimals: tokenADecimals,
				tokenBBalance: "",
				tokenA: tokenB,
				tokenAAddress: tokenBAddress,
				tokenAIcon: tokenBIcon,
				tokenADecimals: tokenBDecimals,
				tokenABalance: "",
				tokenAAmount: "",
				tokenBAmount: "",
				tokenAAllowance: "",
				tokenBAllowance: "",
				tokenAPrice: "",
				tokenBPrice: "",
				multipathSwap: false,
				multipathToken: "",
			},
			() => {
				if (walletConnected) {
					this.fetchBalances();
					this.fetchLiquidity();
				}
			}
		);
	};

	fetchBalances = () => {
		const { tokenA, tokenB } = this.state;
		const importedTokens = fetchImportedTokens();
		let allTokens = [...TOKENS];
		if (importedTokens) {
			allTokens = [...TOKENS, ...importedTokens.data];
		}
		if (tokenA) {
			const selectedToken = allTokens.filter((token) => token.symbol === tokenA);
			if (selectedToken[0].symbol === "BNB") {
				this.fetchBNBBalance("A");
			} else {
				this.fetchBalance(
					this.props.walletAddress,
					selectedToken[0].contractAddress,
					selectedToken[0].contractABI,
					selectedToken[0].decimals,
					"A"
				);
				this.fetchApproval(
					this.props.walletAddress,
					selectedToken[0].contractAddress,
					selectedToken[0].decimals,
					"A"
				);
			}
		}
		if (tokenB) {
			const selectedToken = allTokens.filter((token) => token.symbol === tokenB);
			if (selectedToken[0].symbol === "BNB") {
				this.fetchBNBBalance("B");
			} else {
				this.fetchBalance(
					this.props.walletAddress,
					selectedToken[0].contractAddress,
					selectedToken[0].contractABI,
					selectedToken[0].decimals,
					"B"
				);
				this.fetchApproval(
					this.props.walletAddress,
					selectedToken[0].contractAddress,
					selectedToken[0].decimals,
					"B"
				);
			}
		}
	};

	updateAmount = (value, type) => {
		const { walletConnected } = this.props;
		const { tokenASupply, tokenBSupply } = this.state;
		this.setState(
			{
				[type === "A" ? "tokenAAmount" : "tokenBAmount"]: value,
			},
			() => {
				if (walletConnected) {
					let timer;
					if (type === "A") {
						timer = timerA;
					} else {
						timer = timerB;
					}
					clearTimeout(timer);
					if (value && parseFloat(value) > 0) {
						if (parseFloat(this.state.tokenAAmount) >= parseFloat(tokenASupply)) {
							this.setState({
								invalidPair: true,
								tokenAPrice: "",
								tokenBPrice: "",
							});
						} else if (parseFloat(this.state.tokenBAmount) >= parseFloat(tokenBSupply)) {
							this.setState({
								invalidPair: true,
								tokenAPrice: "",
								tokenBPrice: "",
							});
						} else {
							timer = setTimeout(() => this.estimate(type), 700);
						}
					} else {
						this.setState({
							[type === "A" ? "tokenBAmount" : "tokenAAmount"]: "",
							invalidPair: false,
							tokenAPrice: "",
							tokenBPrice: "",
						});
					}
				}
			}
		);
	};

	estimate = (type) => {
		const {
			tokenAAmount,
			tokenBAmount,
			tokenABalance,
			tokenBBalance,
			tokenAAddress,
			tokenBAddress,
			tokenA,
			tokenB,
			liquidityInfo,
			tokenADecimals,
			tokenBDecimals,
			tokenBSupply,
			tokenASupply,
			multipathSwap,
			multipathToken,
		} = this.state;
		if (tokenABalance && tokenBBalance && liquidityInfo && liquidityInfo.hasLiquidity) {
			if (type === "A") {
				this.setState({ estimatingA: true }, () => {
					let intermediaryTokenAddress;
					if (multipathSwap) {
						intermediaryTokenAddress = MULTIPATH_TOKENS.filter(
							(token) => token.name === multipathToken
						)[0].address;
					}
					const estimateData = {
						amount: tokenAAmount.toString(),
						addresses: multipathSwap
							? [tokenAAddress, intermediaryTokenAddress, tokenBAddress]
							: [tokenAAddress, tokenBAddress],
						token: tokenA,
						decimals: tokenADecimals,
					};
					estimateOutAmounts(estimateData)
						.then((res) => {
							if (res.success) {
								let amount = this.state.tokenAAmount;
								// console.log(tokenAAmount, res.amount)
								if (
									parseFloat(res.amount) >= parseFloat(tokenBSupply) ||
									parseFloat(amount) >= parseFloat(tokenASupply)
								) {
									this.setState({
										tokenBAmount: amount ? parseFloat(res.amount).toFixed(6) : "",
										estimatingA: false,
										invalidPair: true,
										tokenAPrice: "",
										tokenBPrice: "",
									});
								} else {
									this.setState(
										{
											tokenBAmount: amount ? parseFloat(res.amount).toFixed(6) : "",
											estimatingA: false,
											invalidPair: false,
										},
										() => {
											this.calculatePriceImpact();
											this.fetchPrices();
										}
									);
								}
							}
						})
						.catch((err) => {
							this.setState({ estimatingA: false }, () => {
								this.setState({
									invalidPair: true,
									tokenAAmount: "",
									tokenBAmount: "",
								});
							});
						});
				});
			} else if (type === "B") {
				this.setState({ estimatingB: true }, () => {
					let intermediaryTokenAddress;
					if (multipathSwap) {
						intermediaryTokenAddress = MULTIPATH_TOKENS.filter(
							(token) => token.name === multipathToken
						)[0].address;
					}
					const estimateData = {
						amount: tokenBAmount.toString(),
						addresses: multipathSwap
							? [tokenAAddress, intermediaryTokenAddress, tokenBAddress]
							: [tokenAAddress, tokenBAddress],
						token: tokenB,
						decimals: tokenBDecimals,
					};
					estimateInAmounts(estimateData)
						.then((res) => {
							if (res.success) {
								let amount = this.state.tokenBAmount;
								if (
									parseFloat(res.amount) >= parseFloat(tokenASupply) ||
									parseFloat(amount) >= parseFloat(tokenBSupply)
								) {
									this.setState({
										tokenAAmount: amount ? parseFloat(res.amount).toFixed(6) : "",
										estimatingB: false,
										invalidPair: true,
										tokenAPrice: "",
										tokenBPrice: "",
									});
								} else {
									this.setState(
										{
											tokenAAmount: amount ? parseFloat(res.amount).toFixed(6) : "",
											estimatingB: false,
											invalidPair: false,
										},
										() => {
											this.calculatePriceImpact();
											this.fetchPrices();
										}
									);
								}
							}
						})
						.catch((err) => {
							this.setState({ estimatingB: false }, () => {
								this.setState({
									invalidPair: true,
									tokenAAmount: "",
									tokenBAmount: "",
								});
							});
						});
				});
			}
		}
	};

	calculatePriceImpact = (priceData = null) => {
		const { tokenASupply: supplyA, tokenBSupply: supplyB, tokenAAmount: amount } = this.state;
		const tokenASupply = priceData ? priceData.tokenASupply : supplyA;
		const tokenBSupply = priceData ? priceData.tokenBSupply : supplyB;
		const tokenAAmount = priceData ? priceData.amount : amount;
		// console.log(`Swapping ${tokenAAmount} ${tokenA} for ${tokenBAmount} ${tokenB} `)
		// console.log(`${tokenA} supply`, tokenASupply)
		// console.log(`${tokenB} supply`, tokenBSupply)
		const constantProduct = parseFloat(tokenASupply) * parseFloat(tokenBSupply);
		const marketPrice = parseFloat(tokenASupply) / parseFloat(tokenBSupply);
		// console.log(`Price before swap (Market price): 1 ${tokenB} = ${marketPrice} ${tokenA}`)
		const newTokenASupply = parseFloat(tokenASupply) + parseFloat(tokenAAmount);
		// console.log(`${tokenA} supply after swap`, newTokenASupply)
		const newTokenBSupply = constantProduct / newTokenASupply;
		// console.log(`${tokenB} supply after swap`, newTokenBSupply)
		const tokenBReceived = parseFloat(tokenBSupply) - parseFloat(newTokenBSupply);
		// console.log(`${tokenB} received for swapping ${tokenAAmount} ${tokenA}`, tokenBReceived)
		const newPrice = parseFloat(tokenAAmount) / tokenBReceived;
		// console.log(`Price after swap: 1 ${tokenB} = ${newPrice} ${tokenA}`)
		const priceDifference = newPrice - marketPrice;
		const impact = (priceDifference / marketPrice) * 100;
		// console.log('IMPACT', impact)
		if (priceData) {
			return impact;
		} else {
			this.setState(
				{
					impact: impact.toFixed(2),
				},
				() => {
					if (impact <= 20 && impact > 0.01) {
						this.context.updateSlippage(impact.toFixed(2));
					} else {
						this.context.updateSlippage("0.5");
					}
				}
			);
		}
	};

	handleMax = (token) => {
		const { tokenABalance, tokenBBalance } = this.state;
		this.setState(
			{
				[token === "A" ? "tokenAAmount" : "tokenBAmount"]:
					token === "A" ? tokenABalance : tokenBBalance,
			},
			() => this.estimate(token)
		);
	};

	toggleInversion = () => {
		this.setState((state) => {
			return {
				inverted: !state.inverted,
			};
		});
	};

	approve = (token) => {
		const {
			tokenA,
			tokenB,
			tokenAAddress,
			tokenBAddress,
			approvalAmount,
			tokenADecimals,
			tokenBDecimals,
		} = this.state;
		const { walletAddress } = this.props;
		this.setState(
			{
				[token === "A" ? "approvingTokenA" : "approvingTokenB"]: true,
				approving: true,
			},
			() => {
				approveToken(
					token === "A" ? tokenAAddress : tokenBAddress,
					this.props.signer,
					approvalAmount,
					token === "A" ? tokenADecimals : tokenBDecimals
				)
					.then((res) => {
						if (res.success) {
							// console.log(res.data)
							if (res.data.hash) {
								notification.info({
									key: "approvalProcessingNotification",
									message: `${
										token === "A" ? tokenA : tokenB
									} approval is being processed. You can view the transaction here.`,
									btn: <ExternalLink hash={res.data.hash}>View Transaction</ExternalLink>,
									icon: (
										<CircularProgress
											size={25}
											thickness={5}
											style={{
												color: "#DE0102",
												position: "relative",
												top: "6px",
											}}
										/>
									),
									duration: 0,
								});
								try {
									let intervalId = setInterval(async () => {
										try {
											let reciept = await PROVIDER.getTransaction(res.data.hash);
											// console.log('RECEIPT', reciept)
											if (token === "A") {
												if (tokenA !== "BNB") {
													this.fetchApproval(walletAddress, tokenAAddress, tokenADecimals, "A");
												}
											} else {
												if (tokenB !== "BNB") {
													this.fetchApproval(walletAddress, tokenBAddress, tokenBDecimals, "B");
												}
											}
											if (reciept) {
												notification.close("approvalProcessingNotification");
												notification.success({
													key: "approvalSuccessNotification",
													message: `${
														token === "A" ? tokenA : tokenB
													} approval successful. You can view the transaction here`,
													btn: <ExternalLink hash={res.data.hash}>View Transaction</ExternalLink>,
													duration: 0,
												});
												this.setState(
													{
														approving: false,
														[token === "A" ? "tokenAAllowance" : "tokenBAllowance"]: approvalAmount,
														[token === "A" ? "approvingTokenA" : "approvingTokenB"]: false,
														[token === "A" ? "tokenAApproved" : "tokenBApproved"]: true,
														approvalModalVisible: false,
													},
													() => {
														setTimeout(() => this.setState({ approvalAmount: "" }), 500);
													}
												);
												clearInterval(intervalId);
											}
										} catch (e) {
											// console.log(e.message);
										}
									}, 5000);
								} catch (e) {
									this.setState({
										[token === "A" ? "approvingTokenA" : "approvingTokenB"]: false,
										approving: false,
									});
									// console.log(e);
								}
							}
						}
					})
					.catch((err) => {
						this.setState(
							{
								[token === "A" ? "approvingTokenA" : "approvingTokenB"]: false,
								approving: false,
							},
							() => {
								notification.error({
									message: `Couldn't Approve ${token === "A" ? tokenA : tokenB}`,
									description: "Your transaction could not be processed. Please try again later",
								});
							}
						);
					});
			}
		);
	};

	confirmSwap = () => {
		const { impact } = this.state;
		if (parseFloat(impact) > 20) {
			const promptValue = prompt(
				`This swap has a price impact of atleast ${parseInt(
					impact,
					10
				)}%. Please type the word "confirm" to continue with this swap.`
			);
			if (promptValue && promptValue === "confirm") {
				this.setState({ confirmationModalVisible: false }, () => this.swap());
			}
		} else {
			this.setState({ confirmationModalVisible: false }, () => this.swap());
		}
	};

	swap = () => {
		const { tokenA, tokenB } = this.state;
		if (tokenA === "BNB") {
			this.swapBNBForTokens();
		} else if (tokenB === "BNB") {
			this.swapTokensForBNB();
		} else {
			this.swapTokensForTokens();
		}
	};

	swapBNBForTokens = () => {
		const {
			tokenA,
			tokenB,
			tokenAAmount,
			tokenBAmount,
			tokenAAddress,
			tokenBAddress,
			tokenBDecimals,
		} = this.state;
		const { slippage } = this.context;
		const { walletAddress, signer } = this.props;
		const deadline = moment().add(1, "years").format("X");
		const amountOut =
			parseFloat(tokenBAmount) - parseFloat(tokenBAmount) * (parseFloat(slippage) / 100);
		this.setState({ swapping: true }, () => {
			const swapData = {
				amountIn: tokenAAmount,
				amountOutMin: amountOut.toString(),
				tokenAddresses: [WBNB_ADDRESS, tokenBAddress],
				walletAddress: walletAddress,
				deadline: parseFloat(deadline),
				signer: signer,
				decimalsBNB: 18,
				decimals: tokenBDecimals,
			};
			// console.log('SWAP DATA', swapData)
			swapBNBForTokens(swapData)
				.then((res) => {
					if (res.success) {
						if (res.data.hash) {
							const hashArrayString = localStorage.getItem("hashData");
							const tx = {
								hash: res.data.hash,
								amount: parseFloat(tokenBAmount).toFixed(4),
								summary: `Swap ${parseFloat(tokenAAmount).toFixed(4)} ${tokenA} for ${parseFloat(
									tokenBAmount
								).toFixed(4)} ${tokenB}`,
							};
							if (hashArrayString) {
								let hashArray = JSON.parse(hashArrayString);
								hashArray.data.push(tx);
								localStorage.setItem("hashData", JSON.stringify(hashArray));
							} else {
								const newHashArray = {
									data: [tx],
								};
								localStorage.setItem("hashData", JSON.stringify(newHashArray));
							}
							notification.info({
								key: "swapProcessingNotification",
								message: "Transaction is being processed. You can view the transaction here.",
								btn: <ExternalLink hash={res.data.hash}>View Transaction</ExternalLink>,
								icon: (
									<CircularProgress
										size={25}
										thickness={5}
										style={{
											color: "#DE0102",
											position: "relative",
											top: "6px",
										}}
									/>
								),
								duration: 0,
							});
							try {
								let intervalId = setInterval(async () => {
									try {
										let reciept = await PROVIDER.getTransaction(res.data.hash);
										// console.log('RECEIPT', reciept)
										if (reciept) {
											notification.close("swapProcessingNotification");
											notification.success({
												key: "swapSuccessNotification",
												message: "Swap successful. You can view the transaction here.",
												btn: <ExternalLink hash={res.data.hash}>View Transaction</ExternalLink>,
												duration: 0,
											});
											this.setState(
												{
													swapping: false,
													tokenAAmount: "",
													tokenBAmount: "",
												},
												() => {
													const importedTokens = fetchImportedTokens();
													let allTokens = [...TOKENS];
													if (importedTokens) {
														allTokens = [...TOKENS, ...importedTokens.data];
													}
													const A = allTokens.filter(
														(token) => token.symbol === this.state.tokenA
													)[0];
													const B = allTokens.filter(
														(token) => token.symbol === this.state.tokenB
													)[0];
													if (A.symbol === "BNB") {
														this.fetchBNBBalance("A");
													} else {
														this.fetchBalance(
															walletAddress,
															tokenAAddress,
															A.contractABI,
															A.decimals,
															"A"
														);
													}
													if (B.symbol === "BNB") {
														this.fetchBNBBalance("B");
													} else {
														this.fetchBalance(
															walletAddress,
															tokenBAddress,
															B.contractABI,
															B.decimals,
															"B"
														);
													}
												}
											);
											clearInterval(intervalId);
										}
									} catch (e) {
										// console.log(e.message);
									}
								}, 5000);
							} catch (e) {
								this.setState({ swapping: false });
								// console.log(e.message);
							}
						}
					}
				})
				.catch((_) => {
					this.setState({ swapping: false }, () => {
						notification.error({
							message: "Couldn't swap tokens",
							description: "Your transaction could not be processed. Please try again later",
						});
					});
				});
		});
	};

	swapTokensForBNB = () => {
		const {
			tokenA,
			tokenB,
			tokenAAmount,
			tokenBAmount,
			tokenAAddress,
			tokenBAddress,
			tokenADecimals,
		} = this.state;
		const { slippage } = this.context;
		const { walletAddress, signer } = this.props;
		const deadline = moment().add(1, "years").format("X");
		const amountOut =
			parseFloat(tokenBAmount) - parseFloat(tokenBAmount) * (parseFloat(slippage) / 100);
		this.setState({ swapping: true }, () => {
			const swapData = {
				amountIn: tokenAAmount,
				amountOutMin: amountOut.toString(),
				tokenAddresses: [tokenAAddress, WBNB_ADDRESS],
				walletAddress: walletAddress,
				deadline: deadline,
				signer: signer,
				decimalsBNB: 18,
				decimals: tokenADecimals,
			};
			swapTokensForBNB(swapData)
				.then((res) => {
					if (res.success) {
						if (res.data.hash) {
							const hashArrayString = localStorage.getItem("hashData");
							const tx = {
								hash: res.data.hash,
								amount: parseFloat(tokenBAmount).toFixed(4),
								summary: `Swap ${parseFloat(tokenAAmount).toFixed(4)} ${tokenA} for ${parseFloat(
									tokenBAmount
								).toFixed(4)} ${tokenB}`,
							};
							if (hashArrayString) {
								let hashArray = JSON.parse(hashArrayString);
								hashArray.data.push(tx);
								localStorage.setItem("hashData", JSON.stringify(hashArray));
							} else {
								const newHashArray = {
									data: [tx],
								};
								localStorage.setItem("hashData", JSON.stringify(newHashArray));
							}
							notification.info({
								key: "swapProcessingNotification",
								message: "Transaction is being processed. You can view the transaction here.",
								btn: <ExternalLink hash={res.data.hash}>View Transaction</ExternalLink>,
								icon: (
									<CircularProgress
										size={25}
										thickness={5}
										style={{
											color: "#DE0102",
											position: "relative",
											top: "6px",
										}}
									/>
								),
								duration: 0,
							});
							try {
								let intervalId = setInterval(async () => {
									try {
										let reciept = await PROVIDER.getTransaction(res.data.hash);
										// console.log('RECEIPT', reciept)
										if (reciept) {
											notification.close("swapProcessingNotification");
											notification.success({
												key: "swapSuccessNotification",
												message: "Swap successful. You can view the transaction here.",
												btn: <ExternalLink hash={res.data.hash}>View Transaction</ExternalLink>,
												duration: 0,
											});
											this.setState(
												{
													swapping: false,
													tokenAAmount: "",
													tokenBAmount: "",
												},
												() => {
													const importedTokens = fetchImportedTokens();
													let allTokens = [...TOKENS];
													if (importedTokens) {
														allTokens = [...TOKENS, ...importedTokens.data];
													}
													const A = allTokens.filter(
														(token) => token.symbol === this.state.tokenA
													)[0];
													const B = allTokens.filter(
														(token) => token.symbol === this.state.tokenB
													)[0];
													if (A.symbol === "BNB") {
														this.fetchBNBBalance("A");
													} else {
														this.fetchBalance(
															walletAddress,
															tokenAAddress,
															A.contractABI,
															A.decimals,
															"A"
														);
													}
													if (B.symbol === "BNB") {
														this.fetchBNBBalance("B");
													} else {
														this.fetchBalance(
															walletAddress,
															tokenBAddress,
															B.contractABI,
															B.decimals,
															"B"
														);
													}
												}
											);
											clearInterval(intervalId);
										}
									} catch (e) {
										// console.log(e.message);
									}
								}, 5000);
							} catch (e) {
								this.setState({ swapping: false });
								// console.log(e.message);
							}
						}
					}
				})
				.catch((_) => {
					this.setState({ swapping: false }, () => {
						notification.error({
							message: "Couldn't swap tokens",
							description: "Your transaction could not be processed. Please try again later",
						});
					});
				});
		});
	};

	swapTokensForTokens = () => {
		const {
			tokenA,
			tokenB,
			tokenAAmount,
			tokenBAmount,
			tokenAAddress,
			tokenBAddress,
			tokenADecimals,
			tokenBDecimals,
			multipathSwap,
			multipathToken,
		} = this.state;
		const { slippage } = this.context;
		const { walletAddress, signer } = this.props;
		const deadline = moment().add(1, "years").format("X");
		const amountOut =
			parseFloat(tokenBAmount) - parseFloat(tokenBAmount) * (parseFloat(slippage) / 100);
		this.setState({ swapping: true }, () => {
			let intermediaryTokenAddress;
			if (multipathSwap) {
				intermediaryTokenAddress = MULTIPATH_TOKENS.filter(
					(token) => token.name === multipathToken
				)[0].address;
			}
			const swapData = {
				amountIn: tokenAAmount,
				amountOut: amountOut.toString(),
				tokenAddresses: multipathSwap
					? [tokenAAddress, intermediaryTokenAddress, tokenBAddress]
					: [tokenAAddress, tokenBAddress],
				walletAddress: walletAddress,
				deadline: parseFloat(deadline),
				signer: signer,
				amountInDecimals: tokenADecimals,
				amountOutDecimals: tokenBDecimals,
			};
			swapTokens(swapData)
				.then((res) => {
					if (res.success) {
						if (res.data.hash) {
							const hashArrayString = localStorage.getItem("hashData");
							const tx = {
								hash: res.data.hash,
								amount: parseFloat(tokenBAmount).toFixed(4),
								summary: `Swap ${parseFloat(tokenAAmount).toFixed(4)} ${tokenA} for ${parseFloat(
									tokenBAmount
								).toFixed(4)} ${tokenB}`,
							};
							if (hashArrayString) {
								let hashArray = JSON.parse(hashArrayString);
								hashArray.data.push(tx);
								localStorage.setItem("hashData", JSON.stringify(hashArray));
							} else {
								const newHashArray = {
									data: [tx],
								};
								localStorage.setItem("hashData", JSON.stringify(newHashArray));
							}
							notification.info({
								key: "swapProcessingNotification",
								message: "Transaction is being processed. You can view the transaction here.",
								btn: <ExternalLink hash={res.data.hash}>View Transaction</ExternalLink>,
								icon: (
									<CircularProgress
										size={25}
										thickness={5}
										style={{
											color: "#DE0102",
											position: "relative",
											top: "6px",
										}}
									/>
								),
								duration: 0,
							});
							try {
								let intervalId = setInterval(async () => {
									try {
										let reciept = await PROVIDER.getTransaction(res.data.hash);
										// console.log('RECEIPT', reciept)
										if (reciept) {
											notification.close("swapProcessingNotification");
											notification.success({
												key: "swapSuccessNotification",
												message: "Swap successful. You can view the transaction here.",
												btn: <ExternalLink hash={res.data.hash}>View Transaction</ExternalLink>,
												duration: 0,
											});
											this.setState(
												{
													swapping: false,
													tokenAAmount: "",
													tokenBAmount: "",
												},
												() => {
													const importedTokens = fetchImportedTokens();
													let allTokens = [...TOKENS];
													if (importedTokens) {
														allTokens = [...TOKENS, ...importedTokens.data];
													}
													const A = allTokens.filter(
														(token) => token.symbol === this.state.tokenA
													)[0];
													const B = allTokens.filter(
														(token) => token.symbol === this.state.tokenB
													)[0];
													if (A.symbol === "BNB") {
														this.fetchBNBBalance("A");
													} else {
														this.fetchBalance(
															walletAddress,
															tokenAAddress,
															A.contractABI,
															A.decimals,
															"A"
														);
													}
													if (B.symbol === "BNB") {
														this.fetchBNBBalance("B");
													} else {
														this.fetchBalance(
															walletAddress,
															tokenBAddress,
															B.contractABI,
															B.decimals,
															"B"
														);
													}
												}
											);
											clearInterval(intervalId);
										}
									} catch (e) {
										// console.log(e.message);
									}
								}, 5000);
							} catch (e) {
								this.setState({ swapping: false });
								// console.log(e.message);
							}
						}
					}
				})
				.catch((_) => {
					this.setState({ swapping: false }, () => {
						notification.error({
							message: "Couldn't swap tokens",
							description: "Your transaction could not be processed. Please try again later",
						});
					});
				});
		});
	};

	handleRefresh = (tokenSymbol, type) => {
		const importedTokens = fetchImportedTokens();
		let allTokens = [...TOKENS];
		if (importedTokens) {
			allTokens = [...TOKENS, ...importedTokens.data];
		}
		const selectedToken = allTokens.filter((token) => token.symbol === tokenSymbol)[0];
		if (tokenSymbol !== "BNB") {
			this.fetchApproval(
				this.props.walletAddress,
				selectedToken.contractAddress,
				selectedToken.decimals,
				type
			);
		}
		if (tokenSymbol === "BNB") {
			this.fetchBNBBalance(type);
		} else {
			this.fetchBalance(
				this.props.walletAddress,
				selectedToken.contractAddress,
				selectedToken.contractABI,
				selectedToken.decimals,
				type
			);
		}
	};

	handleModalToggle = () => {
		this.setState((state) => {
			return {
				approvalModalVisible: !state.approvalModalVisible,
			};
		});
	};

	resetValues = () => {
		this.setState({
			approvalAmount: "",
			approving: false,
		});
	};

	handlePercentChange = (value) => {
		const { tokenABalance, tokenASupply } = this.state;
		this.setState(
			{
				percent: value,
			},
			() => {
				const amount = parseFloat(tokenABalance) * (this.state.percent / 100);
				this.setState({ tokenAAmount: parseFloat(amount.toFixed(6)) }, () => {
					if (amount >= parseFloat(tokenASupply)) {
						this.setState({
							invalidPair: true,
							tokenAPrice: "",
							tokenBPrice: "",
						});
					} else {
						this.estimate("A");
					}
				});
			}
		);
	};

	render() {
		const {
			tokenA,
			tokenABalance,
			tokenAAllowance,
			tokenB,
			tokenBBalance,
			tokenBAllowance,
			tokenAIcon,
			tokenBIcon,
			tokenAAmount,
			tokenBAmount,
			liquidityInfo,
			swapping,
			loading,
			estimatingA,
			estimatingB,
			approvingTokenA,
			approving,
			approvalModalVisible,
			approvalToken,
			approvalAmount,
			fetchingLiquidity,
			impact,
			tokenAPrice,
			tokenBPrice,
			fetchingPrices,
			inverted,
			invalidPair,
			confirmationModalVisible,
			fetchingTokenA,
			fetchingTokenB,
			multipathSwap,
			multipathToken,
		} = this.state;
		const {
			onModalToggle,
			walletConnected,
			walletAddress,
			signer,
			modalVisible,
			theme,
			onThemeToggle,
			ethBalance,
			vrapBalance,
			history,
		} = this.props;
		const minimumReceived =
			parseFloat(tokenBAmount) -
			parseFloat(tokenBAmount) * (parseFloat(this.context.slippage) / 100);
		return (
			<>
				<Sidebar active="swap" theme={theme} onThemeToggle={onThemeToggle} />
				<div className="app-container">
					<AppBar
						active="swap"
						theme={theme}
						onThemeToggle={onThemeToggle}
						modalVisible={modalVisible}
						onModalToggle={onModalToggle}
						walletAddress={walletAddress}
						walletConnected={walletConnected}
						ethBalance={ethBalance}
						vrapBalance={vrapBalance}
					/>
					<Container maxWidth="md">
						<div className="container">
							<div className="exchange-card">
								<div style={{ zIndex: 1, position: "relative" }}>
									<div className="tabs">
										<a href="/swap" onClick={(e) => e.preventDefault()} data-enabled={true}>
											Swap
										</a>
										<a
											href="/pool"
											onClick={(e) => {
												e.preventDefault();
												history.push("/pool");
											}}
										>
											Liquidity
										</a>
									</div>
									<Swap
										theme={theme}
										fetchingTokenA={fetchingTokenA}
										fetchingTokenB={fetchingTokenB}
										invalidPair={invalidPair}
										fetchingLiquidity={fetchingLiquidity}
										walletConnected={walletConnected}
										walletAddress={walletAddress}
										signer={signer}
										tokenA={tokenA}
										tokenAIcon={tokenAIcon}
										tokenABalance={tokenABalance}
										tokenAAllowance={tokenAAllowance}
										tokenB={tokenB}
										tokenBIcon={tokenBIcon}
										tokenBBalance={tokenBBalance}
										tokenBAllowance={tokenBAllowance}
										onTokenAUpdate={this.updateTokenA}
										onTokenBUpdate={this.updateTokenB}
										tokenAAmount={tokenAAmount}
										tokenBAmount={tokenBAmount}
										onAmountChange={this.updateAmount}
										estimatingA={estimatingA}
										estimatingB={estimatingB}
										onMax={this.handleMax}
										onTokenSwap={this.swapTokensInternal}
										onRefresh={this.handleRefresh}
										onPercentChange={this.handlePercentChange}
									/>
									{walletConnected ? (
										!fetchingPrices && !fetchingTokenA && !fetchingTokenB ? (
											!invalidPair ? (
												tokenAPrice && tokenBPrice ? (
													<div
														style={{
															display: "flex",
															justifyContent: "center",
															marginTop: "1rem",
															fontSize: "13px",
															fontFamily: "normal",
															padding: "0 0.8rem",
														}}
													>
														<div
															style={{
																display: "flex",
																alignItems: "center",
																color: theme === "light" ? "#333" : "#FFF",
															}}
														>
															{!inverted ? (
																<div>
																	1 {tokenA} ~ {parseFloat(tokenAPrice).toFixed(6)} {tokenB}
																</div>
															) : (
																<div>
																	1 {tokenB} ~ {parseFloat(tokenBPrice).toFixed(6)} {tokenA}
																</div>
															)}
															<button className="invert-button" onClick={this.toggleInversion}>
																<GrPowerCycle size={15} />
															</button>
														</div>
													</div>
												) : null
											) : null
										) : null
									) : null}
									<div className="details-section">
										{walletConnected &&
											!fetchingTokenA &&
											!fetchingTokenB &&
											tokenA &&
											tokenB &&
											tokenAAmount &&
											tokenBAmount &&
											!fetchingPrices &&
											!invalidPair &&
											minimumReceived > 0 && (
												<div className="flex-spaced-container" style={{ fontSize: "13px" }}>
													<div>
														Minimum received{" "}
														<Tooltip
															placement="right"
															title="Your transaction will revert if there is a large, unfavourable price movement before it is confirmed."
														>
															<AiOutlineQuestionCircle
																style={{
																	position: "relative",
																	top: "2px",
																	cursor: "pointer",
																}}
															/>
														</Tooltip>
													</div>
													<div>
														{(
															parseFloat(tokenBAmount) -
															parseFloat(tokenBAmount) * (parseFloat(this.context.slippage) / 100)
														).toFixed(6)}{" "}
														{tokenB}
													</div>
												</div>
											)}
										{walletConnected &&
											!fetchingTokenA &&
											!fetchingTokenB &&
											tokenA &&
											tokenB &&
											tokenAAmount &&
											tokenBAmount &&
											!fetchingPrices &&
											!fetchingLiquidity &&
											liquidityInfo &&
											impact &&
											!invalidPair && (
												<div className="flex-spaced-container" style={{ fontSize: "13px" }}>
													<div>Price Impact</div>
													<div data-high-impact={parseFloat(impact) > 20}>
														{parseFloat(impact) < 0.01 ? "< 0.01" : impact} %
													</div>
												</div>
											)}
										{this.context.slippage !== "0.5" && (
											<div className="flex-spaced-container" style={{ fontSize: "13px" }}>
												<div>
													Slippage Tolerance{" "}
													<Tooltip
														placement="right"
														title="Slippage tolerance must be greater than the price impact or else trade will not be executed."
													>
														<AiOutlineQuestionCircle
															style={{
																position: "relative",
																top: "2px",
																cursor: "pointer",
															}}
														/>
													</Tooltip>
												</div>
												<div>{this.context.slippage} %</div>
											</div>
										)}
										{!fetchingLiquidity && multipathSwap && (
											<div className="flex-spaced-container" style={{ fontSize: "13px" }}>
												<div>Route</div>
												<div>{`${tokenA} > ${multipathToken} > ${tokenB}`}</div>
											</div>
										)}
									</div>
									{!walletConnected ? (
										<div className="exchange-button-container">
											<button onClick={onModalToggle}>Connect wallet</button>
										</div>
									) : !tokenA || !tokenB ? (
										<div className="exchange-button-container">
											<button disabled>Select a token</button>
										</div>
									) : fetchingTokenA || fetchingTokenB || loading || fetchingLiquidity ? (
										<div className="exchange-button-container">
											<button disabled>
												<CircularProgress
													size={12}
													thickness={5}
													style={{ color: "var(--primary)" }}
												/>
											</button>
										</div>
									) : liquidityInfo ? (
										liquidityInfo.hasLiquidity ? (
											!invalidPair ? (
												!tokenAAmount || !tokenBAmount ? (
													<div className="exchange-button-container">
														<button disabled>Enter an amount</button>
													</div>
												) : parseFloat(tokenAAmount) <= parseFloat(tokenABalance) ? (
													tokenA !== "BNB" ? (
														parseFloat(tokenAAmount) <= parseFloat(tokenAAllowance) ? (
															parseFloat(impact) <= parseFloat(this.context.slippage) ? (
																minimumReceived > 0 ? (
																	<div className="exchange-button-container">
																		<button
																			style={
																				parseFloat(impact) > 20
																					? {
																							backgroundColor: "#fd761f",
																							borderColor: "#fd761f",
																					  }
																					: {}
																			}
																			onClick={() => {
																				if (!estimatingA && !estimatingB) {
																					this.setState({
																						confirmationModalVisible: true,
																					});
																				}
																			}}
																			disabled={
																				fetchingTokenA || fetchingTokenB || loading || swapping
																			}
																		>
																			Swap
																			{parseFloat(impact) > 20 && " anyway"}{" "}
																			{swapping && (
																				<CircularProgress
																					size={12}
																					thickness={5}
																					style={{
																						color: "var(--primary)",
																						position: "relative",
																						top: "1px",
																					}}
																				/>
																			)}
																		</button>
																	</div>
																) : (
																	<div className="exchange-button-container">
																		<button disabled>Slippage too high</button>
																		<div
																			style={{
																				textAlign: "center",
																				fontSize: "13px",
																				color: "#FFF",
																				margin: "8px auto 0",
																			}}
																		>
																			Reduce slippage tolerance
																		</div>
																	</div>
																)
															) : (
																<div className="exchange-button-container">
																	<button disabled>High Price Impact</button>
																	<div
																		style={{
																			textAlign: "center",
																			fontSize: "13px",
																			color: "#FFF",
																			margin: "8px auto 0",
																		}}
																	>
																		Set slippage higher than {impact} %
																	</div>
																</div>
															)
														) : parseFloat(tokenAAmount) > parseFloat(tokenAAllowance) ? (
															<div className="exchange-button-container">
																<button
																	disabled={approvingTokenA || approving}
																	style={{
																		marginBottom: "0.25rem",
																	}}
																	onClick={() => {
																		this.setState(
																			{
																				approvalToken: "A",
																				approvalAmount: tokenAAmount,
																			},
																			() => this.handleModalToggle()
																		);
																	}}
																>
																	Approve {tokenA}{" "}
																	{approvingTokenA && (
																		<CircularProgress
																			size={12}
																			thickness={5}
																			style={{
																				color: "var(--primary)",
																				position: "relative",
																				top: "1px",
																			}}
																		/>
																	)}
																</button>
																<button disabled>
																	{!invalidPair && liquidityInfo && liquidityInfo.hasLiquidity
																		? "Swap"
																		: "Insufiicient liquidity for this trade"}
																</button>
															</div>
														) : (
															<div className="exchange-button-container">
																<button
																	style={
																		parseFloat(impact) > 20
																			? {
																					backgroundColor: "#fd761f",
																					borderColor: "#fd761f",
																			  }
																			: {}
																	}
																	onClick={() => {
																		if (!estimatingA && !estimatingB) {
																			this.setState({
																				confirmationModalVisible: true,
																			});
																		}
																	}}
																	disabled={fetchingTokenA || fetchingTokenB || loading || swapping}
																>
																	Swap
																	{parseFloat(impact) > 20 && " anyway"}{" "}
																	{swapping && (
																		<CircularProgress
																			size={12}
																			thickness={5}
																			style={{
																				color: "var(--primary)",
																				position: "relative",
																				top: "1px",
																			}}
																		/>
																	)}
																</button>
															</div>
														)
													) : parseFloat(impact) <= parseFloat(this.context.slippage) ? (
														minimumReceived > 0 ? (
															<div className="exchange-button-container">
																<button
																	style={
																		parseFloat(impact) > 20
																			? {
																					backgroundColor: "#fd761f",
																					borderColor: "#fd761f",
																			  }
																			: {}
																	}
																	onClick={() => {
																		if (!estimatingA && !estimatingB) {
																			this.setState({
																				confirmationModalVisible: true,
																			});
																		}
																	}}
																	disabled={fetchingTokenA || fetchingTokenB || loading || swapping}
																>
																	Swap
																	{parseFloat(impact) > 20 && " anyway"}{" "}
																	{swapping && (
																		<CircularProgress
																			size={12}
																			thickness={5}
																			style={{
																				color: "var(--primary)",
																				position: "relative",
																				top: "1px",
																			}}
																		/>
																	)}
																</button>
															</div>
														) : (
															<div className="exchange-button-container">
																<button disabled>Slippage too high</button>
																<div
																	style={{
																		textAlign: "center",
																		fontSize: "13px",
																		color: "#FFF",
																		margin: "8px auto 0",
																	}}
																>
																	Reduce slippage tolerance
																</div>
															</div>
														)
													) : (
														<div className="exchange-button-container">
															<button disabled>High Price Impact</button>
															<div
																style={{
																	textAlign: "center",
																	fontSize: "13px",
																	color: "#FFF",
																	margin: "8px auto 0",
																}}
															>
																Set slippage higher than {impact} %
															</div>
														</div>
													)
												) : (
													<div className="exchange-button-container">
														<button disabled>Insufficient {tokenA} balance</button>
													</div>
												)
											) : (
												<div className="exchange-button-container">
													<button disabled>Insufficient liquidity for this trade</button>
												</div>
											)
										) : (
											<div className="exchange-button-container">
												<button disabled>
													{fetchingLiquidity ? (
														<CircularProgress
															size={12}
															thickness={5}
															style={{
																color: "var(--primary)",
																position: "relative",
																top: "1px",
															}}
														/>
													) : (
														"Insufficient liquidity for this trade"
													)}
												</button>
											</div>
										)
									) : (
										<div className="exchange-button-container">
											<button disabled>
												{fetchingLiquidity ? (
													<CircularProgress
														size={12}
														thickness={5}
														style={{
															color: "var(--primary)",
															position: "relative",
															top: "1px",
														}}
													/>
												) : (
													"Insufficient liquidity for this trade"
												)}
											</button>
										</div>
									)}
								</div>
							</div>
						</div>
					</Container>
				</div>
				<ApproveModal
					open={approvalModalVisible}
					onClose={() => {
						this.handleModalToggle();
						this.resetValues();
					}}
					theme={theme}
					token={approvalToken === "A" ? tokenA : tokenB}
					tokenIcon={approvalToken === "A" ? tokenAIcon : tokenBIcon}
					tokenBalance={approvalToken === "A" ? tokenABalance : tokenBBalance}
					approvalAmount={approvalAmount}
					onAmountChange={(e) => {
						if (!approving) {
							if (e.target.value.match(/^(\d+)?([.]?\d{0,9})?$/)) {
								this.setState({ approvalAmount: e.target.value });
							}
						}
					}}
					onMax={() =>
						this.setState({
							approvalAmount: approvalToken === "A" ? tokenABalance : tokenBBalance,
						})
					}
					onApprove={() => this.approve(approvalToken)}
					approving={approving}
				/>
				<ConfirmSwapModal
					open={confirmationModalVisible}
					onClose={() => {
						this.setState({ confirmationModalVisible: false });
					}}
					theme={theme}
					tokenA={tokenA}
					tokenAIcon={tokenAIcon}
					tokenAAmount={tokenAAmount}
					tokenAPrice={tokenAPrice}
					tokenB={tokenB}
					tokenBIcon={tokenBIcon}
					tokenBAmount={tokenBAmount}
					tokenBPrice={tokenBPrice}
					impact={impact}
					inverted={inverted}
					onInvertToggle={this.toggleInversion}
					onConfirm={this.confirmSwap}
				/>
			</>
		);
	}
}

export default withRouter(ExchangeBNB);
