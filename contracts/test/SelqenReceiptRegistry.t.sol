// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SelqenReceiptRegistry} from "../src/SelqenReceiptRegistry.sol";
import {Deploy} from "../script/Deploy.s.sol";

interface TestVm {
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata reason) external;
    function expectEmit(bool topic1, bool topic2, bool topic3, bool data, address emitter) external;
    function assume(bool condition) external;
    function chainId(uint256 id) external;
}

contract SelqenReceiptRegistryTest {
    TestVm private constant vm = TestVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    SelqenReceiptRegistry private registry;
    bytes32 private constant HASH = keccak256("SELQEN receipt");

    event ReceiptAnchored(bytes32 indexed receiptHash, address indexed author, uint256 timestamp);

    function setUp() public {
        vm.warp(1_800_000_000);
        registry = new SelqenReceiptRegistry();
    }

    function testUnknownHashReturnsZero() public view {
        require(registry.anchoredAt(HASH) == 0, "unexpected anchor");
    }

    function testAnchorStoresTimestampAndEmitsAuthor() public {
        address author = address(0xBEEF);
        vm.expectEmit(true, true, false, true, address(registry));
        emit ReceiptAnchored(HASH, author, block.timestamp);
        vm.prank(author);
        registry.anchor(HASH);
        require(registry.anchoredAt(HASH) == 1_800_000_000, "wrong timestamp");
    }

    function testRejectsZeroHash() public {
        vm.expectRevert(SelqenReceiptRegistry.ZeroHash.selector);
        registry.anchor(bytes32(0));
    }

    function testRejectsDuplicateFromSameAuthor() public {
        registry.anchor(HASH);
        vm.expectRevert(SelqenReceiptRegistry.AlreadyAnchored.selector);
        registry.anchor(HASH);
    }

    function testRejectsDuplicateFromAnotherAuthorAndPreservesTimestamp() public {
        registry.anchor(HASH);
        vm.warp(1_800_000_100);
        vm.expectRevert(SelqenReceiptRegistry.AlreadyAnchored.selector);
        vm.prank(address(0xCAFE));
        registry.anchor(HASH);
        require(registry.anchoredAt(HASH) == 1_800_000_000, "timestamp changed");
    }

    function testDifferentHashesCanBeAnchoredInSameBlock() public {
        bytes32 other = keccak256("another receipt");
        registry.anchor(HASH);
        vm.prank(address(0xCAFE));
        registry.anchor(other);
        require(registry.anchoredAt(HASH) == registry.anchoredAt(other), "wrong timestamp");
    }

    function testFuzzNonzeroHashAnchoredOnce(bytes32 receiptHash, uint64 timestamp) public {
        vm.assume(receiptHash != bytes32(0) && timestamp > 0);
        vm.warp(timestamp);
        registry.anchor(receiptHash);
        require(registry.anchoredAt(receiptHash) == timestamp, "wrong timestamp");
        vm.expectRevert(SelqenReceiptRegistry.AlreadyAnchored.selector);
        registry.anchor(receiptHash);
    }

    function testDeploymentRejectsWrongChainBeforeReadingKey() public {
        Deploy deployment = new Deploy();
        vm.chainId(1);
        vm.expectRevert(bytes("Expected Robinhood Chain mainnet (4663)"));
        deployment.run();
    }
}
