import {

  DEFAULT_SOURCE_TRUST

} from "./default-source-trust.js";

export function getSourceTrust(

  source: string

): number {

  const match =

    DEFAULT_SOURCE_TRUST.find(

      item =>

        item.source ===

        source.toLowerCase()

    );

  return match?.trust ?? 0.5;

}