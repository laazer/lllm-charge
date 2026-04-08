"""
SQLAlchemy models for metrics and performance tracking
"""
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class RequestMetric(Base):
    """Request metrics tracking"""
    
    __tablename__ = "request_metrics"
    
    id = Column(String, primary_key=True)
    
    # Request details
    request_type = Column(String)  # completion, chat, embedding, etc.
    provider = Column(String)  # openai, anthropic, local, etc.
    model_name = Column(String)
    endpoint = Column(String)
    method = Column(String)  # GET, POST, PUT, DELETE
    status_code = Column(Integer)
    
    # Performance metrics
    response_time = Column(Float)  # seconds
    tokens_input = Column(Integer)
    tokens_output = Column(Integer)
    cost = Column(Float)  # cost in USD
    
    # Request metadata
    success = Column(String, default='true')  # SQLite doesn't have native boolean
    error_message = Column(Text)
    user_id = Column(String)
    session_id = Column(String)
    request_size = Column(Integer)  # bytes
    response_size = Column(Integer)  # bytes
    user_agent = Column(String)
    ip_address = Column(String)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<RequestMetric(id='{self.id}', type='{self.request_type}', provider='{self.provider}')>"


class PerformanceMetric(Base):
    """System performance metrics"""
    
    __tablename__ = "performance_metrics"
    
    id = Column(String, primary_key=True)
    
    # System metrics
    cpu_usage = Column(Float)  # percentage
    memory_usage = Column(Float)  # percentage
    disk_usage = Column(Float)  # percentage
    
    # Application metrics
    active_connections = Column(Integer)
    queue_size = Column(Integer)
    cache_hit_rate = Column(Float)  # percentage
    
    # Network metrics
    network_latency = Column(Float)  # milliseconds
    bandwidth_usage = Column(Float)  # bytes per second
    network_io = Column(JSON)  # {"bytes_sent": 0, "bytes_recv": 0}
    
    # Error tracking
    error_count = Column(Integer)
    uptime_seconds = Column(Integer)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    
    def __repr__(self):
        return f"<PerformanceMetric(id='{self.id}', cpu={self.cpu_usage}%, mem={self.memory_usage}%)>"


class CostMetric(Base):
    """Cost tracking metrics"""
    
    __tablename__ = "cost_metrics"
    
    id = Column(String, primary_key=True)
    
    # Cost breakdown
    provider = Column(String)
    service_type = Column(String)  # completion, embedding, fine-tuning, etc.
    cost_per_request = Column(Float)
    total_requests = Column(Integer)
    total_cost = Column(Float)
    
    # Token costs for LLM services
    model_name = Column(String)
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    total_tokens = Column(Integer)
    cost_per_token = Column(Float)
    
    # Savings tracking
    baseline_cost = Column(Float)  # what it would cost without optimization
    actual_cost = Column(Float)  # actual cost with optimization
    savings_amount = Column(Float)  # baseline_cost - actual_cost
    savings_percentage = Column(Float)  # (savings_amount / baseline_cost) * 100
    
    # Quality tracking
    quality_score = Column(Float)  # 0.0-1.0
    execution_time = Column(Float)  # seconds
    context_length = Column(Integer)
    
    # Time period
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<CostMetric(id='{self.id}', provider='{self.provider}', savings={self.savings_percentage}%)>"


class QualityMetric(Base):
    """Response quality metrics"""
    
    __tablename__ = "quality_metrics"
    
    id = Column(String, primary_key=True)
    
    # Quality scores
    relevance_score = Column(Float)  # 0-1
    accuracy_score = Column(Float)  # 0-1
    completeness_score = Column(Float)  # 0-1
    coherence_score = Column(Float)  # 0-1
    overall_quality = Column(Float)  # 0-1, composite score
    
    # Context
    request_id = Column(String)
    provider = Column(String)
    model_name = Column(String)
    
    # Evaluation metadata
    evaluation_method = Column(String)  # human, automated, hybrid
    evaluator_id = Column(String)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    
    def __repr__(self):
        return f"<QualityMetric(id='{self.id}', overall={self.overall_quality}, provider='{self.provider}')>"


class UsageMetric(Base):
    """Usage pattern metrics"""
    
    __tablename__ = "usage_metrics"
    
    id = Column(String, primary_key=True)
    
    # Usage patterns
    user_id = Column(String)
    feature_used = Column(String)  # completion, workflow, agent, etc.
    usage_frequency = Column(Integer)  # times used in period
    
    # Time tracking
    total_time_spent = Column(Float)  # seconds
    average_session_length = Column(Float)  # seconds
    
    # Efficiency metrics
    tasks_completed = Column(Integer)
    success_rate = Column(Float)  # percentage
    
    # Time period
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<UsageMetric(id='{self.id}', user='{self.user_id}', feature='{self.feature_used}')>"


class AlertMetric(Base):
    """Alert and monitoring metrics"""
    
    __tablename__ = "alert_metrics"
    
    id = Column(String, primary_key=True)
    
    # Alert details
    alert_type = Column(String)  # performance, cost, error, security
    severity = Column(String)  # low, medium, high, critical
    status = Column(String)  # active, resolved, acknowledged
    
    # Alert content
    title = Column(String(255))
    description = Column(Text)
    source_component = Column(String)
    
    # Thresholds and values
    threshold_value = Column(Float)
    actual_value = Column(Float)
    
    # Legacy optimization fields (for backward compatibility)
    original_cost = Column(Float)  # USD
    optimized_cost = Column(Float)  # USD
    savings = Column(Float)  # USD
    savings_percentage = Column(Float)  # 0.0-100.0
    optimization_type = Column(String)  # hybrid_routing, local_fallback, caching
    strategy = Column(String)  # specific strategy used
    quality_maintained = Column(Float)  # quality score 0.0-1.0
    
    # Resolution tracking
    acknowledged_by = Column(String)
    resolved_by = Column(String)
    resolution_notes = Column(Text)
    
    # Timestamps
    triggered_at = Column(DateTime, default=func.now())
    acknowledged_at = Column(DateTime)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    
    def __repr__(self):
        return f"<AlertMetric(id='{self.id}', type='{self.alert_type}', severity='{self.severity}')>"