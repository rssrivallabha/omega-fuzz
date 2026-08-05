# Omega Fuzz

Omega Fuzz is a premium, source-level fuzzing platform engineered for security researchers, compiler engineers, and professional developers. 

It moves beyond blind, random mutation by employing deep Abstract Syntax Tree (AST) analysis to deterministically extract constraints, boundaries, and validation checkpoints directly from your source code.

## 🌟 Features

- **Multi-Target Orchestration**: Parses entire source files and automatically spawns isolated campaigns for every discovered callable target.
- **Intelligent Constraint Synthesis**: Evaluates AST `Compare` and `If` nodes to dynamically generate high-value boundary seeds (e.g., automatically generating `-1`, `0`, `1`, `99`, `100`, `101` for a `value < 100` constraint).
- **Explicit Validation Classification**: Distinguishes between intentional input rejection (e.g. explicit `raise ValueError("Invalid")`) and genuine, unexpected system crashes.
- **Zero-Friction UI**: A highly responsive, professional "Mission Control" interface that tells the story of your fuzzing campaign in real-time.
- **Forensic PDF Export**: Generates high-fidelity, highly detailed forensic reports of your campaign findings, complete with target context and deduplicated crash fingerprints.
- **Local Native Execution**: Runs directly on your machine with zero deployment overhead, maximizing performance and keeping your proprietary code completely offline.

---

## 🚀 Getting Started

Omega Fuzz is designed to be run entirely on your local system. No cloud deployments, no external servers. 

### Prerequisites

Before cloning, ensure you have the following installed on your local machine:
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Python** (v3.9 or higher, accessible via `python` or `python3` in your PATH)

### 1. Clone the Repository

Clone this repository to your local machine:

```bash
git clone https://github.com/your-username/omega-fuzz.git
cd omega-fuzz
```

### 2. Install Dependencies

Omega Fuzz is built as an npm monorepo (using Turborepo) containing both the backend orchestration engine and the React frontend. Install all dependencies from the root directory:

```bash
npm install
```

### 3. Build the Monorepo

Compile all the language adapters, core models, and the orchestrator:

```bash
npm run build
```

### 4. Start the Engine & UI

Launch both the backend orchestrator and the frontend development server simultaneously using Turborepo:

```bash
npm run dev
```

Once running, navigate to **`http://localhost:5173`** in your browser to access the Mission Control interface.

---

## 🎯 Running a Campaign

1. **Input Source**: Paste your source code (e.g., a Python script containing multiple functions) into the Mission Control code editor.
2. **Configure Limits**: Adjust the input volume slider to determine how aggressively the fuzzing campaign should run per target.
3. **Initialize Engine**: Click **Initialize Engine**. Omega Fuzz will parse the AST, extract targets, synthesize seeds, and begin streaming live execution telemetry.

### Understanding the Telemetry

As the campaign runs, the live dashboard visualizes the backend orchestrator's reasoning:
- **Live Feed**: Streams adaptive batches of `PASS` events, while expanding interesting discoveries like `UNEXPECTED_EXCEPTION` and `EXPECTED_REJECTION`.
- **Discovery Strategies**: The feed reveals exactly *how* a crash was found (e.g., `Boundary Mutation`, `Constraint Solver`, `Type Mutation`).
- **Telemetry Chart**: Tracks the aggregate execution rate across your targets.
- **Campaign Archive**: The persistent left sidebar automatically saves your fuzzing history using `localStorage` for easy comparison and later review.

Once the campaign concludes, click **Export Forensic PDF** to generate a permanent artifact of all discovered vulnerabilities.

---

## 🛠 Supported Languages

The engine's modular adapter architecture currently includes implementations/stubs for:
- Python (Primary Support)
- JavaScript / TypeScript
- C++
- Go
- Swift
- SQL
