import argparse
from PIL import Image
from fashn_vton import TryOnPipeline

parser = argparse.ArgumentParser()

parser.add_argument("--person", required=True)
parser.add_argument("--garment", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--category", default="tops")

args = parser.parse_args()

pipeline = TryOnPipeline(
    weights_dir="./weights"
)

person = Image.open(args.person).convert("RGB")
garment = Image.open(args.garment).convert("RGB")

result = pipeline(
    person,
    garment,
    category=args.category
)

result.images[0].save(args.output)

print(f"Saved to {args.output}")