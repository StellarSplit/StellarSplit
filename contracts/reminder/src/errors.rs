use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    EscrowNotFound = 1,
    ParticipantNotFound = 2,
    AlreadyPaid = 3,
}
