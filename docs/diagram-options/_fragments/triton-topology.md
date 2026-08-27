## Topology

Draws comprehensive Network, Infrastructure, and Cost-weighted Fabric Topologies with device badges, subnet/VLAN enclosures, preset topology patterns, interface port tags, and router styles.

**Header keyword(s):** `topology`, `topology :: "<Title>"`

---

### Title syntax

| Syntax | Description |
|--------|-------------|
| `topology :: "Enterprise Network"` | Header title syntax using `::` |
| `title "Enterprise Network"` | Standalone title directive |
| `title :: Enterprise Network` | Title directive with `::` |

---

### Topology Layout Patterns

| Pattern | Description |
|---------|-------------|
| `pattern spine-leaf` | 3-tier Clos spine-leaf layout (Spines -> Leaves -> Compute) |
| `pattern hub-spoke` / `pattern star` | Radial layout with central Hub and perimeter Spokes |
| `pattern ring` | Circular closed ring loop |
| `pattern mesh` | Polygonal full/partial peer-to-peer mesh |
| `pattern tiered` | Top-to-bottom hierarchical layout |

---

### Device Roles & Keywords

| Role | Syntax |
|------|--------|
| `router` / `gateway` | `router r1 "Edge Gateway" [10.0.0.1]` |
| `switch` / `tor` / `spine` / `leaf` | `switch sw1 "Core Switch" [100 Gbps]` |
| `firewall` / `waf` | `firewall waf "Web Application Firewall"` |
| `loadbalancer` / `lb` | `loadbalancer alb "Application Load Balancer" [10.0.1.10]` |
| `server` / `host` / `compute` | `server srv1 "Compute Host" [eth0: 10.0.2.10]` |
| `database` / `db` / `storage` | `database db1 "PostgreSQL Primary" [10.0.2.20]` |
| `cloud` / `internet` / `wan` | `cloud wan "Public Internet"` |
| `client` / `device` | `client pc1 "Workstation"` |
| `cluster` / `pod` | `cluster k8s "K8s Production Cluster"` |
| `node` | `node N0 : "Node 0" : "CPU+RAM"` |

---

### Containers & Subnets

```mermaid
subnet "10.0.1.0/24" "Public Subnet (DMZ)"
  router igw "Internet Gateway"
  loadbalancer alb "ALB"
end

zone "Private Compute"
  server srv1 "App 1"
end
```

---

### Connectors, Interfaces & Routing Styles

| Syntax | Description |
|--------|-------------|
| `r1 -- sw1 @orthogonal "10G Trunk"` | Orthogonal Manhattan right-angle routing |
| `a --> b @straight "Direct Link"` | Straight direct line with arrow |
| `c1 <--> c2 @bezier "Tunnel"` | Smooth curved bezier route with bidirectional arrows |
| `r1:eth0 -- sw1:ge-0/0/1` | Labeled interface port endpoints |
| `spine1 -- leaf1, leaf2` | Multi-target connections |

---

### Latency / Cost Tiers & Legends

```mermaid
topology
  title "NUMA Latency Interconnect"
  costs ns
    tier local 90 #27ae60
    tier remote 140 #2f80ed
  node N0 : Node 0
  node N1 : Node 1
  N0 -- N1 : 140
```
