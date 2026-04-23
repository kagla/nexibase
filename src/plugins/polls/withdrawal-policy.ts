export default [
  { model: 'Poll',     policy: 'retain', field: 'authorId',
    reason: 'Public content; anonymized via User join' },
  { model: 'PollVote', policy: 'retain', field: 'userId',
    reason: 'Affects aggregate vote counts; voter rendered as anonymized User via join' },
]
