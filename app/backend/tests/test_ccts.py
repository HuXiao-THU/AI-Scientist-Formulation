from ccts_backend.domain.ccts import CCTSParameters, compute_context_budget, compute_depth_upper_bound, compute_work_context


def test_compute_work_context() -> None:
    value = compute_work_context(total_context=32000, static_overhead=3500, history_context=7000)
    assert value == 21500


def test_depth_upper_bound_with_alpha() -> None:
    depth = compute_depth_upper_bound(
        total_context=32000,
        static_overhead=3500,
        task_demand=8600,
        mean_information_gain=50,
        alpha=10.0,
    )
    assert depth == 39


def test_compute_context_budget() -> None:
    params = CCTSParameters(
        total_context=32000,
        static_overhead=3500,
        task_demand=8600,
        mean_information_gain=50,
        alpha=10.0,
    )
    c_hist, c_work = compute_context_budget(
        total_context=params.total_context,
        static_overhead=params.static_overhead,
        mean_information_gain=params.mean_information_gain,
        alpha=params.alpha,
        depth=2,
    )
    assert c_hist == 1000.0
    assert c_work == 27500.0
