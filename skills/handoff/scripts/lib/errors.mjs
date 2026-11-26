// Error classes shared by the helper's library files and its command line (handoff.mjs).
//
// `InputError` is a problem with what the caller handed in — a file that is missing or unreadable,
// a document that is not a handoff. The command line turns it into exit 1 and a stderr message.
// Anything else that escapes a command is an internal error, exit 2.

export class InputError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InputError'
  }
}
