# Kubernetes Observability Bootcamp - Practical Lab

## 🎯 **Lab Objective**
Deploy a complete microservices observability stack on Kubernetes using Minikube. Students must successfully deploy and configure all components to pass the assessment.

## 📋 **Assessment Criteria**
- [ ] Minikube cluster running
- [ ] All application pods healthy
- [ ] Grafana accessible with dashboards showing data
- [ ] Prometheus metrics being scraped
- [ ] Distributed tracing working
- [ ] Log aggregation functional
- [ ] Frontend-backend communication working

## 🛠 **Prerequisites**

### Required Tools
```bash
# Install required tools (macOS)
brew install minikube kubectl docker helm

# Verify installations
minikube version
kubectl version --client
docker --version
helm version
```

### System Requirements
- 8GB RAM minimum
- 4 CPU cores
- 20GB free disk space
- Docker Desktop running

## 🚀 **Lab Instructions**

### Step 1: Start Minikube Cluster

```bash
# Start Minikube with sufficient resources
minikube start --memory=6144 --cpus=4 --disk-size=20g

# Enable required addons
minikube addons enable ingress
minikube addons enable metrics-server

# Verify cluster is running
kubectl cluster-info
kubectl get nodes
```

### Step 2: Create Kubernetes Manifests

Create the following directory structure:
```
k8s/
├── namespace.yaml
├── configmaps/
├── deployments/
├── services/
└── ingress/
```

#### 2.1 Create Namespace
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: shopmicro
  labels:
    name: shopmicro
```

#### 2.2 PostgreSQL Database
```yaml
# k8s/deployments/postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: shopmicro
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: "shopmicro"
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          value: "postgres"
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: shopmicro
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

#### 2.3 Redis Cache
```yaml
# k8s/deployments/redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: shopmicro
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: shopmicro
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

### Step 3: Deploy Observability Stack

#### 3.1 Mimir (Metrics Storage)
```yaml
# k8s/configmaps/mimir-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mimir-config
  namespace: shopmicro
data:
  mimir.yaml: |
    target: all
    server:
      http_listen_port: 9009
    common:
      storage:
        backend: filesystem
        filesystem:
          dir: /data
    blocks_storage:
      filesystem:
        dir: /data/blocks
    compactor:
      data_dir: /data/compactor
    distributor:
      ring:
        kvstore:
          store: memberlist
    ingester:
      ring:
        kvstore:
          store: memberlist
    ruler_storage:
      filesystem:
        dir: /data/ruler
    store_gateway:
      sharding_ring:
        kvstore:
          store: memberlist
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mimir
  namespace: shopmicro
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mimir
  template:
    metadata:
      labels:
        app: mimir
    spec:
      containers:
      - name: mimir
        image: grafana/mimir:latest
        args:
        - -config.file=/etc/mimir/mimir.yaml
        - -target=all
        ports:
        - containerPort: 9009
        volumeMounts:
        - name: config
          mountPath: /etc/mimir
        - name: data
          mountPath: /data
      volumes:
      - name: config
        configMap:
          name: mimir-config
      - name: data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: mimir
  namespace: shopmicro
spec:
  selector:
    app: mimir
  ports:
  - port: 9009
    targetPort: 9009
```

#### 3.2 Loki (Log Aggregation)
```yaml
# k8s/deployments/loki.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: shopmicro
data:
  loki.yaml: |
    server:
      http_listen_port: 3100
    auth_enabled: false
    common:
      storage:
        filesystem:
          chunks_directory: /tmp/loki/chunks
          rules_directory: /tmp/loki/rules
      replication_factor: 1
      ring:
        instance_addr: 127.0.0.1
        kvstore:
          store: inmemory
    schema_config:
      configs:
        - from: 2020-10-24
          store: tsdb
          object_store: filesystem
          schema: v13
          index:
            prefix: index_
            period: 24h
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: shopmicro
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
      - name: loki
        image: grafana/loki:latest
        args:
        - -config.file=/etc/loki/loki.yaml
        ports:
        - containerPort: 3100
        volumeMounts:
        - name: config
          mountPath: /etc/loki
        - name: data
          mountPath: /tmp/loki
      volumes:
      - name: config
        configMap:
          name: loki-config
      - name: data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: loki
  namespace: shopmicro
spec:
  selector:
    app: loki
  ports:
  - port: 3100
    targetPort: 3100
```

### Step 4: Deploy Application Services

#### 4.1 Backend Service
```yaml
# k8s/deployments/backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: shopmicro
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: shopmicro-backend:latest
        imagePullPolicy: Never
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        - name: POSTGRES_URL
          value: "postgresql://postgres:postgres@postgres:5432/shopmicro"
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: OTEL_SERVICE_NAME
          value: "shopmicro-backend"
        ports:
        - containerPort: 3001
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: shopmicro
spec:
  selector:
    app: backend
  ports:
  - port: 3001
    targetPort: 3001
```

### Step 5: Build and Load Images

```bash
# Build Docker images
docker build -t shopmicro-backend:latest ./backend
docker build -t shopmicro-frontend:latest ./frontend
docker build -t shopmicro-ml-service:latest ./ml-service

# Load images into Minikube
minikube image load shopmicro-backend:latest
minikube image load shopmicro-frontend:latest
minikube image load shopmicro-ml-service:latest
```

### Step 6: Deploy All Components

```bash
# Apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# Wait for deployments
kubectl wait --for=condition=available --timeout=300s deployment --all -n shopmicro
```

### Step 7: Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n shopmicro

# Check services
kubectl get svc -n shopmicro

# Port forward to access services
kubectl port-forward -n shopmicro svc/grafana 3000:3000 &
kubectl port-forward -n shopmicro svc/frontend 8080:3000 &
kubectl port-forward -n shopmicro svc/backend 3001:3001 &
```

## 🧪 **Assessment Tests**

### Test 1: Cluster Health
```bash
# All pods should be Running
kubectl get pods -n shopmicro
# Expected: All pods in Running state
```

### Test 2: Service Connectivity
```bash
# Test backend health
curl http://localhost:3001/health
# Expected: {"status":"healthy","timestamp":"..."}

# Test frontend
curl http://localhost:8080
# Expected: HTML response
```

### Test 3: Metrics Collection
```bash
# Check backend metrics
curl http://localhost:3001/metrics | grep shopmicro_backend
# Expected: Prometheus metrics output
```

### Test 4: Grafana Dashboards
```bash
# Access Grafana
open http://localhost:3000
# Login: admin/admin
# Expected: Dashboards with data
```

## 🎯 **Success Criteria**

Students pass when:
- [ ] All pods show `Running` status
- [ ] All services respond to health checks
- [ ] Grafana shows metrics data in dashboards
- [ ] Frontend can communicate with backend
- [ ] No error logs in any component
- [ ] Prometheus targets are `UP`

## 🔧 **Troubleshooting Guide**

### Common Issues

**Pods stuck in Pending:**
```bash
kubectl describe pod <pod-name> -n shopmicro
# Check resource constraints and node capacity
```

**Image pull errors:**
```bash
# Ensure images are loaded in Minikube
minikube image ls | grep shopmicro
```

**Service connectivity issues:**
```bash
# Check service endpoints
kubectl get endpoints -n shopmicro
```

### Debug Commands
```bash
# View pod logs
kubectl logs -f <pod-name> -n shopmicro

# Execute into pod
kubectl exec -it <pod-name> -n shopmicro -- /bin/sh

# Check resource usage
kubectl top pods -n shopmicro
```

## 📚 **Learning Objectives**

By completing this lab, students will:
1. Deploy microservices on Kubernetes
2. Configure observability stack (metrics, logs, traces)
3. Understand Kubernetes networking and services
4. Practice troubleshooting containerized applications
5. Implement monitoring and alerting

## 🎮 **Easter Eggs & Hidden Challenges**

### 🥚 **Easter Egg #1: The Secret Endpoint**
There's a hidden endpoint in the backend service that reveals a special message. Find it by exploring the API!
- **Hint**: It's related to the bootcamp theme
- **Reward**: Special badge in your assessment

### 🥚 **Easter Egg #2: The Konami Code**
The frontend has a hidden feature activated by a famous gaming sequence. Try it!
- **Hint**: ↑↑↓↓←→←→BA
- **Reward**: Unlock developer mode with extra metrics

### 🥚 **Easter Egg #3: The Metrics Detective**
Find the metric that tracks "coffee consumption" in the ML service
- **Hint**: Check the custom business metrics
- **Reward**: Coffee emoji appears in Grafana dashboard title

### 🥚 **Easter Egg #4: The Pod Whisperer**
Name one of your pods with a specific pattern to unlock a special log message
- **Hint**: Use a famous Kubernetes mascot name
- **Reward**: ASCII art appears in pod logs

### 🥚 **Easter Egg #5: The Time Traveler**
Set a specific annotation on your namespace to activate retro mode
- **Hint**: `retro.mode: "1985"`
- **Reward**: All timestamps display in retro format

## 🏆 **Achievement System**

### 🥇 **Deployment Master**
- Deploy all services without any restarts
- All pods reach Running state within 5 minutes

### 🥈 **Troubleshoot Hero**
- Successfully debug and fix at least 2 common issues
- Document your solutions in comments

### 🥉 **Metrics Guru**
- Create a custom dashboard in Grafana
- Add at least 3 different visualization types

### 🎯 **Easter Egg Hunter**
- Find all 5 hidden easter eggs
- Screenshot each discovery for proof

### 🚀 **Performance Optimizer**
- Configure resource limits that keep CPU usage under 50%
- Achieve sub-100ms response times on health checks

### 🔍 **Security Sentinel**
- Add security contexts to all deployments
- Implement network policies (bonus challenge)

## 🏆 **Bonus Challenges**

1. **Horizontal Pod Autoscaling**: Configure HPA for backend service
2. **Persistent Storage**: Add persistent volumes for databases
3. **Ingress Configuration**: Set up ingress for external access
4. **Resource Limits**: Configure resource requests and limits
5. **Health Checks**: Implement comprehensive liveness/readiness probes
6. **🎪 Chaos Engineering**: Randomly kill pods and ensure system recovers
7. **🎨 Custom Dashboards**: Create themed Grafana dashboards with fun visualizations

---

**Time Allocation:** 3-4 hours
**Difficulty:** Intermediate
**Prerequisites:** Basic Kubernetes knowledge, Docker experience
