from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pandas as pd
import os
import shutil
from typing import Optional

from backend.gemini_categorizer import GeminiCategorizer
from backend.effort_extractor import EffortExtractor
from backend.analysis import TicketAnalyzer
from backend.excel_exporter import ExcelExporter

app = FastAPI(title="Ticket AI Analysis API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs('output', exist_ok=True)

# Global state
pipeline_results = {
    'df': None,
    'analyzer': None,
    'status': 'idle',
    'message': '',
    'error': None
}

def load_csv_robustly(filepath: str) -> pd.DataFrame:
    """Try various encodings to load the CSV safely"""
    encodings = ['utf-8', 'latin-1', 'utf-8-sig', 'cp1252']
    for enc in encodings:
        try:
            df = pd.read_csv(filepath, encoding=enc)
            if df.empty:
                raise ValueError("The uploaded CSV is empty.")
            return df
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    return pd.read_csv(filepath)

def run_pipeline(filepath: str):
    global pipeline_results
    try:
        pipeline_results['status'] = 'running'
        pipeline_results['error'] = None
        pipeline_results['message'] = 'Loading and detecting CSV encoding...'
        print(f"\n[BACKEND] Starting pipeline for: {filepath}")

        df = load_csv_robustly(filepath)
        print(f"[BACKEND] Success: Loaded {len(df)} rows. Columns: {df.columns.tolist()}")

        pipeline_results['message'] = 'Categorizing with Gemini AI...'
        print("[BACKEND] Initiating Gemini Categorization...")
        categorizer = GeminiCategorizer()
        df = categorizer.categorize_tickets(df)
        print("[BACKEND] Gemini Categorization complete.")

        pipeline_results['message'] = 'Extracting effort from work notes...'
        print("[BACKEND] Starting Effort Extraction...")
        extractor = EffortExtractor()
        df = extractor.extract_effort(df)
        print("[BACKEND] Effort Extraction complete.")

        pipeline_results['message'] = 'Running analysis engine...'
        print("[BACKEND] Running Ticket Analysis Engine...")
        analyzer = TicketAnalyzer(df)

        pipeline_results['message'] = 'Generating Excel visualization...'
        print("[BACKEND] Generating Excel Report...")
        exporter = ExcelExporter()
        exporter.export(df, analyzer)
        print("[BACKEND] Excel Report generated at: output/ticket_analysis.xlsx")

        pipeline_results['df'] = df
        pipeline_results['analyzer'] = analyzer
        pipeline_results['status'] = 'complete'
        pipeline_results['message'] = 'Analysis complete'
        print("[BACKEND] Pipeline finished successfully.\n")

    except Exception as e:
        pipeline_results['status'] = 'error'
        pipeline_results['message'] = 'Pipeline failed'
        pipeline_results['error'] = str(e)
        print(f"[BACKEND] Pipeline error: {e}")

@app.post("/api/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Handle multipart file upload and start pipeline in background"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No selected file")
    
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Reset state
    global pipeline_results
    pipeline_results['status'] = 'running'
    pipeline_results['message'] = 'Upload received, initializing pipeline...'
    pipeline_results['df'] = None
    pipeline_results['analyzer'] = None
    pipeline_results['error'] = None
    
    # Add to background tasks
    background_tasks.add_task(run_pipeline, filepath)
    
    return {
        'status': 'running', 
        'message': 'Analysis started in background.'
    }

@app.get("/api/status")
async def get_status():
    return {
        'status': pipeline_results['status'],
        'message': pipeline_results['message'],
        'error': pipeline_results['error']
    }

@app.get("/api/summary")
async def get_summary():
    if not pipeline_results['analyzer']:
        raise HTTPException(status_code=400, detail="No analysis data available. Please upload a file first.")
    return pipeline_results['analyzer'].get_summary()

@app.get("/api/heavy-hitters")
async def get_heavy_hitters(top_n: int = 15):
    if not pipeline_results['analyzer']:
        raise HTTPException(status_code=400, detail="No data")
    return pipeline_results['analyzer'].get_heavy_hitters(top_n)

@app.get("/api/effort")
async def get_effort():
    if not pipeline_results['analyzer']:
        raise HTTPException(status_code=400, detail="No data")
    return pipeline_results['analyzer'].get_effort_summary()

@app.get("/api/category-breakdown")
async def get_category_breakdown():
    if not pipeline_results['analyzer']:
        raise HTTPException(status_code=400, detail="No data")
    return pipeline_results['analyzer'].get_category_breakdown()

@app.get("/api/volume-trends")
async def get_volume_trends():
    if not pipeline_results['analyzer']:
        raise HTTPException(status_code=400, detail="No data")
    return pipeline_results['analyzer'].get_volume_by_month()

@app.get("/api/download-excel")
async def download_excel():
    path = 'output/ticket_analysis.xlsx'
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Excel report not found. Has the analysis finished?")
    return FileResponse(path, filename="ticket_analysis.xlsx")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
