import { products } from "./products";
import { buildResponse } from "./utils";

export const handler = async () => {
  return buildResponse(200, products);
};
