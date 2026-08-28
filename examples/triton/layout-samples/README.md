# Triton Layout Samples — Review & Refinement Gallery

This directory contains the refined and publication-ready versions of the 19 Triton layout samples. Each diagram has been restructured and routed to eliminate overlap, visual imbalance, awkward counter-flows, and clutter.

---

## Gallery Index

| Sample | Diagram Type | Key Improvement / Fix Applied | File Link |
| :--- | :--- | :--- | :--- |
| **01** | `flowchart TD` | Grouped ingress sources and folded restoration pipeline with balanced vertical hierarchy. | [sample-01-shard-restoration.mmd](sample-01-shard-restoration.mmd) |
| **02** | `architecture-beta` | Harmonized co-directional Top $\to$ Bottom flow across both chambers; eliminated upward back-routing. | [sample-02-co-directional-architecture.mmd](sample-02-co-directional-architecture.mmd) |
| **03** | `poster` | Smooth cross-cell orthogonal routing between shard locator and active aligner. | [sample-03-lateral-shard-poster.mmd](sample-03-lateral-shard-poster.mmd) |
| **04** | `architecture-beta` | Replaced 1:3 vertical "skyscraper" tower with balanced 2-row folded cycle loop. | [sample-04-folded-cycle-architecture.mmd](sample-04-folded-cycle-architecture.mmd) |
| **05** | `architecture-beta` | Aligned 3-column parallel processing lanes with clean vertical interconnects. | [sample-05-parallel-lane-array.mmd](sample-05-parallel-lane-array.mmd) |
| **06** | `architecture-beta` | Structured dual-pillar architecture resolving constraint cycles and backward cross-edges. | [sample-06-dual-pillar-engine.mmd](sample-06-dual-pillar-engine.mmd) |
| **07** | `flowchart TD` | Aligned 3-column audit stages directly above fact extractors converging into reconciliation. | [sample-07-audit-reconciliation.mmd](sample-07-audit-reconciliation.mmd) |
| **08** | `flowchart LR` | Switched to horizontal chamber layout with clean top/bottom ingress/egress loops. | [sample-08-horizontal-sandbox-engine.mmd](sample-08-horizontal-sandbox-engine.mmd) |
| **09** | `flowchart TD` | Balanced dual storage tiers (Lattice vs Vessel) with clear horizontal cross-link gap. | [sample-09-dual-storage-tiers.mmd](sample-09-dual-storage-tiers.mmd) |
| **10** | `flowchart TD` | Structured AST expression tree with semantic `Title :: Subtitle` operators and leaves. | [sample-10-structured-ast-expression.mmd](sample-10-structured-ast-expression.mmd) |
| **11** | `flowchart TD` | Balanced decision tree with symmetric subgraphs and graceful convergence into resume. | [sample-11-balanced-decision-tree.mmd](sample-11-balanced-decision-tree.mmd) |
| **12** | `flowchart TD` | Encapsulated 3-step conveyance pipeline to eliminate dead canvas void on pause branch. | [sample-12-balanced-token-bucket.mmd](sample-12-balanced-token-bucket.mmd) |
| **13** | `architecture-beta` | Decoupled parallel weavers and lattice forms, eliminating criss-crossing links. | [sample-13-chassis-decoupled-architecture.mmd](sample-13-chassis-decoupled-architecture.mmd) |
| **14** | `poster` | Balanced 2-column poster combining iterative Mark Traversal with Fracture-Stable Return. | [sample-14-harmonization-traversal-poster.mmd](sample-14-harmonization-traversal-poster.mmd) |
| **15** | `flowchart TD` | Subgraph-encapsulated miss resolution path for clean cache-aside architecture. | [sample-15-cache-aside-subgraph-flow.mmd](sample-15-cache-aside-subgraph-flow.mmd) |
| **16** | `flowchart LR` | Re-oriented cyclic cadence engine horizontally to eliminate node-crossing back-edges. | [sample-16-cadence-alignment-pipeline.mmd](sample-16-cadence-alignment-pipeline.mmd) |
| **17** | `flowchart TB` | Aligned dual-scope subgraphs with parallel, straight vertical mapping rails. | [sample-17-aligned-subgraph-rails.mmd](sample-17-aligned-subgraph-rails.mmd) |
| **18** | `poster` | Dual symmetrical QVN gathering cards using clean bidirectional edge flow and legend. | [sample-18-dual-qvn-poster.mmd](sample-18-dual-qvn-poster.mmd) |
| **19** | `flowchart TD` | Organized validation ladder checks with isolated rejection queue and retry flow. | [sample-19-validation-ladder-pipeline.mmd](sample-19-validation-ladder-pipeline.mmd) |

---

## Detailed Review

### Sample 01: Shard Restoration Pipeline
* **Before**: Unbalanced single side-node (`catalog`) on a vertical spine causing asymmetric whitespace.
* **Fix**: Encapsulated `sources` in an ingress subgraph above the sequential folding & restoration pipeline.
* **Source**: [sample-01-shard-restoration.mmd](sample-01-shard-restoration.mmd) | **Render**: [sample-01-shard-restoration.svg](sample-01-shard-restoration.svg)

### Sample 02: Co-directional Dual-Chamber Architecture
* **Before**: Left chamber routed Top $\to$ Bottom while right chamber routed Bottom $\to$ Top, creating an inverted "U" flow.
* **Fix**: Harmonized Top $\to$ Bottom routing across both chambers with a clean horizontal bridge.
* **Source**: [sample-02-co-directional-architecture.mmd](sample-02-co-directional-architecture.mmd) | **Render**: [sample-02-co-directional-architecture.svg](sample-02-co-directional-architecture.svg)

### Sample 03: Lateral Shard Renewal Poster
* **Before**: Disconnected nodegraph cells with irregular node box sizes.
* **Fix**: Standardized node labels, aligned cell padding, and clean cross-cell orthogonal link.
* **Source**: [sample-03-lateral-shard-poster.mmd](sample-03-lateral-shard-poster.mmd) | **Render**: [sample-03-lateral-shard-poster.svg](sample-03-lateral-shard-poster.svg)

### Sample 04: Folded Cycle Architecture
* **Before**: 6 services stacked strictly in a single column producing a 1:3 vertical "skyscraper".
* **Fix**: Folded into a 2-row cyclic loop with horizontal and vertical transitions.
* **Source**: [sample-04-folded-cycle-architecture.mmd](sample-04-folded-cycle-architecture.mmd) | **Render**: [sample-04-folded-cycle-architecture.svg](sample-04-folded-cycle-architecture.svg)

### Sample 05: Parallel Lane Meridian Array
* **Before**: Parallel lanes suffered from irregular horizontal spacing.
* **Fix**: Locked 3 parallel vertical rails across workers, database folding partitions, and flux disks.
* **Source**: [sample-05-parallel-lane-array.mmd](sample-05-parallel-lane-array.mmd) | **Render**: [sample-05-parallel-lane-array.svg](sample-05-parallel-lane-array.svg)

### Sample 06: Dual-Pillar QVN Meridian Frame
* **Before**: Backward edge `qvlos:T --> B:process` triggered contradictory placement constraints.
* **Fix**: Structured process and resource pillars with clean downward flow and lateral runtime binding.
* **Source**: [sample-06-dual-pillar-engine.mmd](sample-06-dual-pillar-engine.mmd) | **Render**: [sample-06-dual-pillar-engine.svg](sample-06-dual-pillar-engine.svg)

### Sample 07: Aligned Audit Pipeline & Reconciliation
* **Before**: Asymmetric edge spans where `allocation_facts` had to traverse 3 vertical tiers to reach `reconcile`.
* **Fix**: Subgraph tiers align stages directly over their facts, feeding cleanly into reconciliation.
* **Source**: [sample-07-audit-reconciliation.mmd](sample-07-audit-reconciliation.mmd) | **Render**: [sample-07-audit-reconciliation.svg](sample-07-audit-reconciliation.svg)

### Sample 08: Horizontal Chamber with Ingress/Egress Loop
* **Before**: Cyclic ingress/egress loops cut through intermediate vertical layers.
* **Fix**: Left-to-Right orientation with top and bottom bypass channels around the central sandbox.
* **Source**: [sample-08-horizontal-sandbox-engine.mmd](sample-08-horizontal-sandbox-engine.mmd) | **Render**: [sample-08-horizontal-sandbox-engine.svg](sample-08-horizontal-sandbox-engine.svg)

### Sample 09: Balanced Dual-Tier Storage Architecture
* **Before**: Terminal horizontal edge `table -.-> vessel` crowded the bottom margin.
* **Fix**: Symmetrical lattice and vessel tier subgraphs with dedicated cross-link corridor.
* **Source**: [sample-09-dual-storage-tiers.mmd](sample-09-dual-storage-tiers.mmd) | **Render**: [sample-09-dual-storage-tiers.svg](sample-09-dual-storage-tiers.svg)

### Sample 10: Structured AST Expression Tree
* **Before**: Rigid flowchart boxes without semantic hierarchy.
* **Fix**: Two-tier `Title :: Subtitle` node labels differentiating conjunctions, scopes, and fixed/variant terms.
* **Source**: [sample-10-structured-ast-expression.mmd](sample-10-structured-ast-expression.mmd) | **Render**: [sample-10-structured-ast-expression.svg](sample-10-structured-ast-expression.svg)

### Sample 11: Balanced Decision Tree with Multi-Path Convergence
* **Before**: Giant diamond text distortion and unbalanced 3-layer drop to resume.
* **Fix**: Segmented into Lineage Match and Fracture Recovery subgraphs with balanced multi-path joins.
* **Source**: [sample-11-balanced-decision-tree.mmd](sample-11-balanced-decision-tree.mmd) | **Render**: [sample-11-balanced-decision-tree.svg](sample-11-balanced-decision-tree.svg)

### Sample 12: Balanced Token Bucket & Credit Conveyance
* **Before**: 4-node happy path left the single-node pause branch with a giant empty void.
* **Fix**: Conveyance pipeline encapsulated in a subgraph alongside an isolated throttle control node.
* **Source**: [sample-12-balanced-token-bucket.mmd](sample-12-balanced-token-bucket.mmd) | **Render**: [sample-12-balanced-token-bucket.svg](sample-12-balanced-token-bucket.svg)

### Sample 13: Decoupled Multi-Chassis Architecture
* **Before**: Bidirectional cross-group links intersected vertical return paths.
* **Fix**: Symmetrical alignment of parallel weavers and lattice forms with clear vertical drainage.
* **Source**: [sample-13-chassis-decoupled-architecture.mmd](sample-13-chassis-decoupled-architecture.mmd) | **Render**: [sample-13-chassis-decoupled-architecture.svg](sample-13-chassis-decoupled-architecture.svg)

### Sample 14: Repeatable Folding & Harmonization Poster
* **Before**: 600px tall flowchart cell next to 300px tall nodegraph cell created severe white space mismatch.
* **Fix**: Balanced aspect ratios and clean backward edge loop in traversal cell.
* **Source**: [sample-14-harmonization-traversal-poster.mmd](sample-14-harmonization-traversal-poster.mmd) | **Render**: [sample-14-harmonization-traversal-poster.svg](sample-14-harmonization-traversal-poster.svg)

### Sample 15: Clean Cache-Aside Resolution Flow
* **Before**: Cache-hit branch dropped through 3 empty tiers to merge into retain.
* **Fix**: Encapsulated uncached miss flow in a subgraph, balancing the direct cache hit path.
* **Source**: [sample-15-cache-aside-subgraph-flow.mmd](sample-15-cache-aside-subgraph-flow.mmd) | **Render**: [sample-15-cache-aside-subgraph-flow.svg](sample-15-cache-aside-subgraph-flow.svg)

### Sample 16: Co-directional Cadence Alignment Pipeline
* **Before**: Nested feedback cycles crossed backwards over multiple vertical nodes.
* **Fix**: Horizontal LR dataflow pipeline with top/bottom feedback routing.
* **Source**: [sample-16-cadence-alignment-pipeline.mmd](sample-16-cadence-alignment-pipeline.mmd) | **Render**: [sample-16-cadence-alignment-pipeline.svg](sample-16-cadence-alignment-pipeline.svg)

### Sample 17: Parallel Aligned Subgraph-to-Subgraph Rails
* **Before**: Internal edges pulled nodes horizontally, slanting cross-subgraph vertical arrows.
* **Fix**: Aligned corresponding ports across upper and lower scopes for straight, clean vertical rails.
* **Source**: [sample-17-aligned-subgraph-rails.mmd](sample-17-aligned-subgraph-rails.mmd) | **Render**: [sample-17-aligned-subgraph-rails.svg](sample-17-aligned-subgraph-rails.svg)

### Sample 18: Dual QVN Gathering & Motion Poster
* **Before**: Overlapping straight lines for opposite `rise` and `fall` edges.
* **Fix**: Bidirectional flowcards with unified labels and span-2 legend card.
* **Source**: [sample-18-dual-qvn-poster.mmd](sample-18-dual-qvn-poster.mmd) | **Render**: [sample-18-dual-qvn-poster.svg](sample-18-dual-qvn-poster.svg)

### Sample 19: Structured Validation Ladder & Rejection Queue
* **Before**: 3 rejection edges funneled into a single queue node, distorting the happy path spine.
* **Fix**: Partitioned validation checks ladder from the queue & conveyance processing pipeline.
* **Source**: [sample-19-validation-ladder-pipeline.mmd](sample-19-validation-ladder-pipeline.mmd) | **Render**: [sample-19-validation-ladder-pipeline.svg](sample-19-validation-ladder-pipeline.svg)
