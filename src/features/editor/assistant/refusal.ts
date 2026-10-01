// A refused edit (#310): the executor turns it into a result the model reads.
export class Refusal extends Error {}
export const refuse = (message: string): never => {
  throw new Refusal(message);
};
