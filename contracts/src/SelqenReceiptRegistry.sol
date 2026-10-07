// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Records receipt hashes, not receipt validity or transaction safety.
contract SelqenReceiptRegistry {
    mapping(bytes32 => uint256) public anchoredAt;

    event ReceiptAnchored(bytes32 indexed receiptHash, address indexed author, uint256 timestamp);

    error ZeroHash();
    error AlreadyAnchored();

    function anchor(bytes32 receiptHash) external {
        if (receiptHash == bytes32(0)) revert ZeroHash();
        if (anchoredAt[receiptHash] != 0) revert AlreadyAnchored();
        anchoredAt[receiptHash] = block.timestamp;
        emit ReceiptAnchored(receiptHash, msg.sender, block.timestamp);
    }
}
