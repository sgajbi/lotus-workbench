import sharp from "sharp";
import selectorParser from "postcss-selector-parser";
import { SourceMapConsumer } from "source-map-js";

describe("security patch vendor compatibility", () => {
  it("retains native image resize and PNG decoding", async () => {
    const png = await sharp({ create: { width: 4, height: 2, channels: 3, background: "#ff0000" } })
      .resize(2, 3, { fit: "fill" }).png().toBuffer();
    expect(await sharp(png).metadata()).toMatchObject({ format: "png", width: 2, height: 3 });
    const pixels = await sharp(png).raw().toBuffer();
    expect([...pixels.subarray(0, 3)]).toEqual([255, 0, 0]);
  });

  it("retains class and attribute selector parsing used by CSS governance", () => {
    const root = selectorParser().astSync('.portfolio[data-currency="SGD"] > .position');
    const classes: string[] = [];
    const attributes: string[] = [];
    root.walkClasses((node) => { classes.push(node.value); });
    root.walkAttributes((node) => { attributes.push(`${node.attribute}=${node.value}`); });
    expect(classes).toEqual(["portfolio", "position"]);
    expect(attributes).toEqual(["data-currency=SGD"]);
  });

  it("consumes a fixed standard VLQ source-map vector", () => {
    const consumer = new SourceMapConsumer({ version: "3", sources: ["portfolio.ts"],
      names: ["value"], mappings: "AAIEA" });
    expect(consumer.originalPositionFor({ line: 1, column: 0 })).toEqual({
      source: "portfolio.ts", line: 5, column: 2, name: "value",
    });
  });
});
