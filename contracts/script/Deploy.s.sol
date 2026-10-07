// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SelqenReceiptRegistry} from "../src/SelqenReceiptRegistry.sol";

interface DeploymentVm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Deploy {
    DeploymentVm private constant vm = DeploymentVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (SelqenReceiptRegistry registry) {
        require(block.chainid == 4663, "Expected Robinhood Chain mainnet (4663)");
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        registry = new SelqenReceiptRegistry();
        vm.stopBroadcast();
    }
}
