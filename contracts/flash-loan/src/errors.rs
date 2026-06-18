use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientFunds = 4,
    InsufficientRepayment = 9,
    LoanNotFound = 5,
    LoanAlreadyRepaid = 6,
    FlashLoanCallbackFailed = 7,
    ReentrancyGuardActive = 8,
}
