import type {
  AnswerVerificationInput,
  AnswerVerificationOutcome
} from "../types/answer-verification.js";

export interface AnswerVerifier {

  verify(
    input: AnswerVerificationInput
  ): AnswerVerificationOutcome;

}
