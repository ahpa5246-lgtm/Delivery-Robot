"""Run a deterministic campus replay and export data for plotting. stdlib only."""
import argparse
import json
from pathlib import Path

from cdr_sim.campus import Campus, ReplayOptions, replay


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--destination", choices=["library", "engineering", "student_center"],
                        default="library")
    parser.add_argument("--scenario", choices=["clear", "construction", "sensor_dropout", "estop"],
                        default="construction")
    parser.add_argument("--output", type=Path, default=Path("experiments/campus_demo.json"))
    args = parser.parse_args()
    result = {"map": Campus().as_dict(),
              "run": replay(ReplayOptions(seed=args.seed, destination=args.destination,
                                          scenario=args.scenario))}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result["run"].items()
                      if k in ("status","reason","distance_m","duration_sim_s",
                               "energy_estimated_wh","replans","model")}, indent=2))


if __name__ == "__main__":
    main()
