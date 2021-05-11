import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import "antd/dist/antd.css";
import "rc-slider/assets/index.css";
import reportWebVitals from "./reportWebVitals";
import bsc from "@binance-chain/bsc-use-wallet";
import { UseWalletProvider } from "use-wallet";
import { AppProvider } from "./state/AppContext";
ReactDOM.render(
	<React.StrictMode>
		<AppProvider>
			<Router>
				<UseWalletProvider connectors={{ bsc }}>
					<App />
				</UseWalletProvider>
			</Router>
		</AppProvider>
	</React.StrictMode>,
	document.getElementById("root")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
