"""
SQLAlchemy models for workflow/flow management
"""
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class Flow(Base):
    """Flow model for workflow automation"""
    
    __tablename__ = "flows"
    
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Flow structure stored as JSON
    nodes = Column(JSON)
    edges = Column(JSON)
    
    # Flow metadata
    type = Column(String)  # workflow, automation, pipeline
    status = Column(String, default='draft')
    category = Column(String)
    tags = Column(JSON)
    
    # Settings and configuration
    settings = Column(JSON)
    triggers = Column(JSON)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    executions = relationship("FlowExecution", back_populates="flow")
    
    def __repr__(self):
        return f"<Flow(id='{self.id}', name='{self.name}', status='{self.status}')>"


class FlowExecution(Base):
    """Flow execution tracking"""
    
    __tablename__ = "flow_executions"
    
    id = Column(String, primary_key=True)
    flow_id = Column(String, ForeignKey("flows.id"))
    status = Column(String, default='pending')  # pending, running, completed, failed, cancelled
    
    # Execution metadata
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    execution_time = Column(Integer)  # milliseconds
    
    # Input/output data
    input_data = Column(JSON)
    output_data = Column(JSON)
    error_message = Column(Text)
    
    # Progress tracking
    current_node = Column(String)
    completed_nodes = Column(JSON)  # list of completed node IDs
    failed_nodes = Column(JSON)  # list of failed node IDs
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    flow = relationship("Flow", back_populates="executions")
    
    def __repr__(self):
        return f"<FlowExecution(id='{self.id}', flow_id='{self.flow_id}', status='{self.status}')>"


class FlowTemplate(Base):
    """Flow template for reusable workflows"""
    
    __tablename__ = "flow_templates"
    
    id = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Template structure
    template_nodes = Column(JSON)
    template_edges = Column(JSON)
    
    # Template metadata
    category = Column(String)
    tags = Column(JSON)
    version = Column(String)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<FlowTemplate(id='{self.id}', name='{self.name}', version='{self.version}')>"


class FlowVersion(Base):
    """Flow versioning for workflow history"""
    
    __tablename__ = "flow_versions"
    
    id = Column(String, primary_key=True)
    flow_id = Column(String, ForeignKey("flows.id"))
    version = Column(String, nullable=False)
    
    # Versioned flow structure
    nodes_snapshot = Column(JSON)
    edges_snapshot = Column(JSON)
    settings_snapshot = Column(JSON)
    
    # Version metadata
    change_summary = Column(Text)
    created_by = Column(String)
    
    created_at = Column(DateTime, default=func.now())
    
    def __repr__(self):
        return f"<FlowVersion(id='{self.id}', flow_id='{self.flow_id}', version='{self.version}')>"


class FlowSchedule(Base):
    """Flow scheduling for automated execution"""
    
    __tablename__ = "flow_schedules"
    
    id = Column(String, primary_key=True)
    flow_id = Column(String, ForeignKey("flows.id"))
    schedule_type = Column(String)  # cron, interval, one_time
    
    # Schedule configuration
    cron_expression = Column(String)
    interval_seconds = Column(Integer)
    scheduled_time = Column(DateTime)
    
    # Schedule metadata
    is_active = Column(String, default='true')  # SQLite doesn't have native boolean
    last_run = Column(DateTime)
    next_run = Column(DateTime)
    run_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<FlowSchedule(id='{self.id}', flow_id='{self.flow_id}', type='{self.schedule_type}')>"